package llm_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/llm"
)

type reply struct {
	Answer string `json:"answer"`
}

var replySchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"answer": map[string]any{"type": "string"},
	},
	"required":             []string{"answer"},
	"additionalProperties": false,
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

func newAnthropic(t *testing.T, status int, body string) (*llm.Anthropic, *http.Request, *[]byte) {
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
	return llm.NewAnthropic("test", option.WithBaseURL(srv.URL), option.WithMaxRetries(0)), &req, &recorded
}

func TestAnthropic_Structured(t *testing.T) {
	tests := []struct {
		name    string
		status  int
		body    string
		want    reply
		wantErr error
		anyErr  bool
	}{
		{
			name:   "happy path - returns reply",
			status: http.StatusOK,
			body:   messageBody(t, `{"answer":"hello"}`, "end_turn"),
			want:   reply{Answer: "hello"},
		},
		{
			name:    "error - refusal",
			status:  http.StatusOK,
			body:    messageBody(t, "", "refusal"),
			wantErr: llm.ErrRefused,
		},
		{
			name:    "error - invalid json",
			status:  http.StatusOK,
			body:    messageBody(t, "not json", "end_turn"),
			wantErr: llm.ErrInvalidResponse,
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
			client, _, _ := newAnthropic(t, tt.status, tt.body)
			var got reply

			// when
			err := client.Structured(t.Context(), "system prompt", "user message", replySchema, &got)

			// then
			switch {
			case tt.wantErr != nil:
				require.ErrorIs(t, err, tt.wantErr)
			case tt.anyErr:
				require.Error(t, err)
				require.NotErrorIs(t, err, llm.ErrRefused)
				require.NotErrorIs(t, err, llm.ErrInvalidResponse)
			default:
				require.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}

	t.Run("happy path - request shape", func(t *testing.T) {
		// given
		client, req, recorded := newAnthropic(t, http.StatusOK, messageBody(t, `{"answer":"hello"}`, "end_turn"))
		var got reply

		// when
		err := client.Structured(t.Context(), "system prompt", "user message", replySchema, &got)

		// then
		require.NoError(t, err)
		assert.Contains(t, req.Header.Get("anthropic-beta"), "server-side-fallback-2026-06-01")
		var body struct {
			Model        string `json:"model"`
			MaxTokens    int    `json:"max_tokens"`
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
			System []struct {
				Text string `json:"text"`
			} `json:"system"`
			Messages []struct {
				Role    string `json:"role"`
				Content []struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.Unmarshal(*recorded, &body))
		assert.Equal(t, "claude-opus-5", body.Model)
		assert.Equal(t, 2000, body.MaxTokens)
		assert.Equal(t, "low", body.OutputConfig.Effort)
		assert.Equal(t, "json_schema", body.OutputConfig.Format.Type)
		assert.Equal(t, false, body.OutputConfig.Format.Schema["additionalProperties"])
		assert.Contains(t, body.OutputConfig.Format.Schema, "properties")
		require.Len(t, body.Fallbacks, 1)
		assert.Equal(t, "claude-opus-4-8", body.Fallbacks[0].Model)
		require.Len(t, body.System, 1)
		assert.Equal(t, "system prompt", body.System[0].Text)
		require.Len(t, body.Messages, 1)
		assert.Equal(t, "user", body.Messages[0].Role)
		require.Len(t, body.Messages[0].Content, 1)
		assert.Equal(t, "user message", body.Messages[0].Content[0].Text)
	})
}
