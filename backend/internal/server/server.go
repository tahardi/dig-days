package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/tahardi/dig-days/backend/internal/model"
	"github.com/tahardi/dig-days/backend/internal/transcribe"
)

func NewServer(
	key string,
	transcriber transcribe.Transcriber,
	extractor model.Extractor,
	logger *slog.Logger,
) http.Handler {
	_, _ = transcriber, extractor
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	return logRequests(logger, requireKey(key, mux))
}

type statusRecorder struct {
	http.ResponseWriter

	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.InfoContext(
			r.Context(),
			"request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration", time.Since(start),
		)
	})
}
