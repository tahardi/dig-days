package server_test

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/server"
)

func TestServer_Health(t *testing.T) {
	want, err := os.ReadFile("../../../api/testdata/health-response.json")
	require.NoError(t, err)

	newRequest := func(t *testing.T, url string, method string) *http.Request {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), method, url+"/health", nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer secret")
		return req
	}

	t.Run("happy path - returns ok", func(t *testing.T) {
		// given
		var logs bytes.Buffer
		logger := slog.New(slog.NewTextHandler(&logs, nil))
		srv := httptest.NewServer(server.NewServer("secret", nil, nil, logger))
		defer srv.Close()

		// when
		resp, err := http.DefaultClient.Do(newRequest(t, srv.URL, http.MethodGet))
		require.NoError(t, err)
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		// then
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.JSONEq(t, string(want), string(body))
		assert.NotEmpty(t, logs.String())
		assert.NotContains(t, logs.String(), "secret")
		assert.Contains(t, logs.String(), "/health")
	})

	t.Run("error - post is not allowed", func(t *testing.T) {
		// given
		srv := httptest.NewServer(server.NewServer("secret", nil, nil, slog.New(slog.DiscardHandler)))
		defer srv.Close()

		// when
		resp, err := http.DefaultClient.Do(newRequest(t, srv.URL, http.MethodPost))
		require.NoError(t, err)
		defer resp.Body.Close()

		// then
		assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode)
	})
}
