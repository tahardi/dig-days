package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/server"
	"github.com/tahardi/dig-days/backend/mocks"
)

func TestNewServer(t *testing.T) {
	t.Run("happy path - nil logger is allowed", func(t *testing.T) {
		// given
		transcriber := mocks.NewTranscriber(t)
		extractor := mocks.NewExtractor(t)

		// when
		handler, err := server.NewServer("secret", transcriber, extractor, nil)

		// then
		require.NoError(t, err)
		assert.NotNil(t, handler)
	})

	t.Run("error - nil transcriber", func(t *testing.T) {
		// given
		extractor := mocks.NewExtractor(t)

		// when
		_, err := server.NewServer("secret", nil, extractor, nil)

		// then
		require.ErrorIs(t, err, server.ErrNilTranscriber)
	})

	t.Run("error - nil extractor", func(t *testing.T) {
		// given
		transcriber := mocks.NewTranscriber(t)

		// when
		_, err := server.NewServer("secret", transcriber, nil, nil)

		// then
		require.ErrorIs(t, err, server.ErrNilExtractor)
	})

	t.Run("error - health without key is unauthorized", func(t *testing.T) {
		// given
		handler, err := server.NewServer(
			"secret",
			mocks.NewTranscriber(t),
			mocks.NewExtractor(t),
			slog.New(slog.DiscardHandler),
		)
		require.NoError(t, err)
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()

		// when
		handler.ServeHTTP(rec, req)

		// then
		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})
}
