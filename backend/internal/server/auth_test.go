package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequireKey(t *testing.T) {
	unauthorized, err := os.ReadFile("../../../api/testdata/error-unauthorized.json")
	require.NoError(t, err)

	tests := []struct {
		name       string
		header     string
		wantStatus int
		wantCalled bool
	}{
		{"no header", "", http.StatusUnauthorized, false},
		{"wrong token", "Bearer wrong", http.StatusUnauthorized, false},
		{"no scheme", "secret", http.StatusUnauthorized, false},
		{"valid token", "Bearer secret", http.StatusOK, true},
		{"lowercase scheme", "bearer secret", http.StatusOK, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			called := false
			inner := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				called = true
				w.WriteHeader(http.StatusOK)
			})
			handler := requireKey("secret", inner)
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()

			// when
			handler.ServeHTTP(rec, req)

			// then
			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Equal(t, tt.wantCalled, called)
			if !tt.wantCalled {
				assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
				assert.JSONEq(t, string(unauthorized), rec.Body.String())
			}
		})
	}
}
