package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/llm"
	"github.com/tahardi/dig-days/backend/internal/model"
	"github.com/tahardi/dig-days/backend/internal/server"
	"github.com/tahardi/dig-days/backend/mocks"
)

const (
	testKey      = "secret"
	oversizeSize = 51 << 20
)

var errUpstream = errors.New("upstream detail that must not leak")

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("../../../api/testdata/" + name)
	require.NoError(t, err)
	return data
}

func errorBody(t *testing.T, code string, message string) string {
	t.Helper()
	data, err := json.Marshal(model.ErrorResponse{Error: model.ErrorBody{Code: code, Message: message}})
	require.NoError(t, err)
	return string(data)
}

func newProcessRequest(t *testing.T, key string, audio []byte, catalog *string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if audio != nil {
		part, err := writer.CreateFormFile("audio", "clip.m4a")
		require.NoError(t, err)
		_, err = part.Write(audio)
		require.NoError(t, err)
	}
	if catalog != nil {
		require.NoError(t, writer.WriteField("catalog", *catalog))
	}
	require.NoError(t, writer.Close())
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/process", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	return req
}

func TestServer_Process(t *testing.T) {
	catalogJSON := string(readFixture(t, "catalog.json"))
	notJSON := "not json"
	var catalog model.Catalog
	require.NoError(t, json.Unmarshal([]byte(catalogJSON), &catalog))
	var response model.ProcessResponse
	require.NoError(t, json.Unmarshal(readFixture(t, "process-response-existing.json"), &response))
	audio := []byte("fake audio")

	tests := []struct {
		name         string
		key          string
		audio        []byte
		catalog      *string
		transcribe   func(*mocks.Transcriber, *string)
		extract      func(*mocks.Extractor)
		wantStatus   int
		wantBody     string
		wantTempGone bool
	}{
		{
			name:    "happy path - returns draft",
			key:     testKey,
			audio:   audio,
			catalog: &catalogJSON,
			transcribe: func(m *mocks.Transcriber, path *string) {
				m.EXPECT().
					Transcribe(mock.Anything, mock.Anything).
					RunAndReturn(func(_ context.Context, audioPath string) (string, error) {
						*path = audioPath
						return response.Transcript, nil
					})
			},
			extract: func(m *mocks.Extractor) {
				m.EXPECT().Extract(mock.Anything, response.Transcript, catalog).Return(response.Draft, nil)
			},
			wantStatus:   http.StatusOK,
			wantBody:     string(readFixture(t, "process-response-existing.json")),
			wantTempGone: true,
		},
		{
			name:    "error - empty transcript",
			key:     testKey,
			audio:   audio,
			catalog: &catalogJSON,
			transcribe: func(m *mocks.Transcriber, path *string) {
				m.EXPECT().
					Transcribe(mock.Anything, mock.Anything).
					RunAndReturn(func(_ context.Context, audioPath string) (string, error) {
						*path = audioPath
						return "   ", nil
					})
			},
			wantStatus:   http.StatusUnprocessableEntity,
			wantBody:     string(readFixture(t, "error-no-speech.json")),
			wantTempGone: true,
		},
		{
			name:       "error - missing audio",
			key:        testKey,
			catalog:    &catalogJSON,
			wantStatus: http.StatusBadRequest,
			wantBody:   errorBody(t, "bad_request", "audio is required"),
		},
		{
			name:       "error - missing catalog",
			key:        testKey,
			audio:      audio,
			wantStatus: http.StatusBadRequest,
			wantBody:   errorBody(t, "bad_request", "catalog is required"),
		},
		{
			name:       "error - invalid catalog",
			key:        testKey,
			audio:      audio,
			catalog:    &notJSON,
			wantStatus: http.StatusBadRequest,
			wantBody:   errorBody(t, "bad_request", "catalog must be valid JSON"),
		},
		{
			name:       "error - payload too large",
			key:        testKey,
			audio:      make([]byte, oversizeSize),
			catalog:    &catalogJSON,
			wantStatus: http.StatusRequestEntityTooLarge,
			wantBody:   errorBody(t, "payload_too_large", "request body is too large"),
		},
		{
			name:    "error - transcriber failure",
			key:     testKey,
			audio:   audio,
			catalog: &catalogJSON,
			transcribe: func(m *mocks.Transcriber, path *string) {
				m.EXPECT().
					Transcribe(mock.Anything, mock.Anything).
					RunAndReturn(func(_ context.Context, audioPath string) (string, error) {
						*path = audioPath
						return "", errUpstream
					})
			},
			wantStatus:   http.StatusBadGateway,
			wantBody:     errorBody(t, "upstream_failed", "transcribing audio failed"),
			wantTempGone: true,
		},
		{
			name:    "error - extractor refusal",
			key:     testKey,
			audio:   audio,
			catalog: &catalogJSON,
			transcribe: func(m *mocks.Transcriber, path *string) {
				m.EXPECT().
					Transcribe(mock.Anything, mock.Anything).
					RunAndReturn(func(_ context.Context, audioPath string) (string, error) {
						*path = audioPath
						return response.Transcript, nil
					})
			},
			extract: func(m *mocks.Extractor) {
				m.EXPECT().Extract(mock.Anything, response.Transcript, catalog).Return(model.Draft{}, llm.ErrRefused)
			},
			wantStatus:   http.StatusBadGateway,
			wantBody:     errorBody(t, "upstream_failed", "extracting draft failed"),
			wantTempGone: true,
		},
		{
			name:       "error - no key",
			audio:      audio,
			catalog:    &catalogJSON,
			wantStatus: http.StatusUnauthorized,
			wantBody:   string(readFixture(t, "error-unauthorized.json")),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			transcriber := mocks.NewTranscriber(t)
			extractor := mocks.NewExtractor(t)
			var audioPath string
			if tt.transcribe != nil {
				tt.transcribe(transcriber, &audioPath)
			}
			if tt.extract != nil {
				tt.extract(extractor)
			}
			handler, err := server.NewServer(testKey, transcriber, extractor, slog.New(slog.DiscardHandler))
			require.NoError(t, err)
			req := newProcessRequest(t, tt.key, tt.audio, tt.catalog)
			rec := httptest.NewRecorder()

			// when
			handler.ServeHTTP(rec, req)

			// then
			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.JSONEq(t, tt.wantBody, rec.Body.String())
			assert.NotContains(t, rec.Body.String(), errUpstream.Error())
			if tt.wantTempGone {
				require.NotEmpty(t, audioPath)
				assert.NoFileExists(t, audioPath)
			}
		})
	}
}
