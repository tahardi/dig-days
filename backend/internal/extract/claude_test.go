package extract_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/extract"
	"github.com/tahardi/dig-days/backend/internal/model"
)

const transcript = "I worked on the second step-up for White Wolf today."

func loadResponse(t *testing.T) model.ProcessResponse {
	t.Helper()
	data, err := os.ReadFile("../../../api/testdata/process-response-existing.json")
	require.NoError(t, err)
	var resp model.ProcessResponse
	require.NoError(t, json.Unmarshal(data, &resp))
	return resp
}

func messageBody(t *testing.T, text string, stopReason string) string {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"id":            "msg_test",
		"type":          "message",
		"role":          "assistant",
		"model":         "claude-opus-5",
		"content":       []map[string]any{{"type": "text", "text": text}},
		"stop_reason":   stopReason,
		"stop_sequence": nil,
		"usage":         map[string]any{"input_tokens": 1, "output_tokens": 1},
	})
	require.NoError(t, err)
	return string(body)
}

func marshalDraft(t *testing.T, draft model.Draft) string {
	t.Helper()
	data, err := json.Marshal(draft)
	require.NoError(t, err)
	return string(data)
}

func newClaude(t *testing.T, status int, body string) (extract.Claude, *http.Request, *[]byte) {
	t.Helper()
	var req http.Request
	var recorded []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req = *r
		recorded, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	client := anthropic.NewClient(
		option.WithBaseURL(srv.URL),
		option.WithAPIKey("test"),
		option.WithMaxRetries(0),
	)
	return extract.NewClaude(client), &req, &recorded
}

func TestClaude_Extract(t *testing.T) {
	catalog := loadCatalog(t)
	existing := loadResponse(t).Draft
	invalidTrail := existing
	invalidTrail.Trail = model.Ref{ExistingID: new(int64(99))}
	invalidTrail.Feature = model.Ref{}
	clearedTrail := invalidTrail
	clearedTrail.Trail = model.Ref{}
	clearedTrail.Notes = "trail id 99 not found"

	tests := []struct {
		name    string
		status  int
		body    string
		want    model.Draft
		wantErr error
		anyErr  bool
	}{
		{
			name:   "happy path - returns draft",
			status: http.StatusOK,
			body:   messageBody(t, marshalDraft(t, existing), "end_turn"),
			want:   existing,
		},
		{
			name:   "happy path - validation applied",
			status: http.StatusOK,
			body:   messageBody(t, marshalDraft(t, invalidTrail), "end_turn"),
			want:   clearedTrail,
		},
		{
			name:    "error - refusal",
			status:  http.StatusOK,
			body:    messageBody(t, "", "refusal"),
			wantErr: extract.ErrRefused,
		},
		{
			name:    "error - invalid json",
			status:  http.StatusOK,
			body:    messageBody(t, "not json", "end_turn"),
			wantErr: extract.ErrInvalidResponse,
		},
		{
			name:   "error - server failure",
			status: http.StatusInternalServerError,
			body:   `{"type":"error","error":{"type":"api_error","message":"boom"}}`,
			anyErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			claude, _, _ := newClaude(t, tt.status, tt.body)

			// when
			got, err := claude.Extract(t.Context(), transcript, catalog)

			// then
			switch {
			case tt.wantErr != nil:
				require.ErrorIs(t, err, tt.wantErr)
			case tt.anyErr:
				require.Error(t, err)
				require.NotErrorIs(t, err, extract.ErrRefused)
			default:
				require.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}

	t.Run("happy path - request shape", func(t *testing.T) {
		// given
		claude, req, recorded := newClaude(t, http.StatusOK, messageBody(t, marshalDraft(t, existing), "end_turn"))
		catalogJSON, err := json.Marshal(catalog)
		require.NoError(t, err)

		// when
		_, err = claude.Extract(t.Context(), transcript, catalog)

		// then
		require.NoError(t, err)
		assert.Contains(t, req.Header.Get("anthropic-beta"), "server-side-fallback-2026-06-01")
		var body struct {
			Model        string `json:"model"`
			OutputConfig struct {
				Effort string `json:"effort"`
				Format struct {
					Type   string         `json:"type"`
					Schema map[string]any `json:"schema"`
				} `json:"format"`
			} `json:"output_config"`
			Fallbacks []struct {
				Model string `json:"model"`
			} `json:"fallbacks"`
			Messages []struct {
				Role    string `json:"role"`
				Content []struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.Unmarshal(*recorded, &body))
		assert.Equal(t, "claude-opus-5", body.Model)
		assert.Equal(t, "low", body.OutputConfig.Effort)
		assert.Equal(t, "json_schema", body.OutputConfig.Format.Type)
		assert.Equal(t, false, body.OutputConfig.Format.Schema["additionalProperties"])
		assert.Contains(t, body.OutputConfig.Format.Schema, "$defs")
		require.Len(t, body.Fallbacks, 1)
		assert.Equal(t, "claude-opus-4-8", body.Fallbacks[0].Model)
		require.Len(t, body.Messages, 1)
		require.Len(t, body.Messages[0].Content, 1)
		assert.Equal(t, "Catalog:\n"+string(catalogJSON)+"\n\nTranscript:\n"+transcript, body.Messages[0].Content[0].Text)
	})
}
