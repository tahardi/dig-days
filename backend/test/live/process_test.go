package live_test

import (
	"bytes"
	"cmp"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/extract"
	"github.com/tahardi/dig-days/backend/internal/llm"
	"github.com/tahardi/dig-days/backend/internal/model"
	"github.com/tahardi/dig-days/backend/internal/server"
	"github.com/tahardi/dig-days/backend/internal/transcribe"
)

const liveKey = "live-test-key"

func TestProcess(t *testing.T) {
	// given
	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	whisperBin := os.Getenv("WHISPER_BIN")
	whisperModel := os.Getenv("WHISPER_MODEL")
	if anthropicKey == "" || whisperBin == "" || whisperModel == "" {
		t.Skip("set ANTHROPIC_API_KEY, WHISPER_BIN and WHISPER_MODEL (make test-live)")
	}
	transcriber := transcribe.NewWhisper(
		cmp.Or(os.Getenv("FFMPEG_BIN"), "ffmpeg"),
		whisperBin,
		whisperModel,
		t.TempDir(),
	)
	extractor := extract.NewClaude(llm.NewAnthropic(anthropicKey))
	logger := slog.New(slog.NewTextHandler(t.Output(), nil))
	handler, err := server.NewServer(liveKey, transcriber, extractor, logger)
	require.NoError(t, err)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	audio, err := os.ReadFile("../testdata/white-wolf.m4a")
	require.NoError(t, err)
	catalog, err := os.ReadFile("../../../api/testdata/catalog.json")
	require.NoError(t, err)
	body, contentType := multipartBody(t, audio, catalog)
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, srv.URL+"/process", body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+liveKey)

	// when
	resp, err := http.DefaultClient.Do(req)

	// then
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	t.Logf("response: %s", raw)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var got model.ProcessResponse
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.NotEmpty(t, got.Transcript)
	require.NotNil(t, got.Draft.Trail.ExistingID)
	require.NotNil(t, got.Draft.Feature.ExistingID)
	assert.EqualValues(t, 1, *got.Draft.Trail.ExistingID)
	assert.EqualValues(t, 2, *got.Draft.Feature.ExistingID)
}

func multipartBody(t *testing.T, audio []byte, catalog []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("audio", "white-wolf.m4a")
	require.NoError(t, err)
	_, err = part.Write(audio)
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("catalog", string(catalog)))
	require.NoError(t, writer.Close())
	return body, writer.FormDataContentType()
}
