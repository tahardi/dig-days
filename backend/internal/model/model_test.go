package model_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/model"
)

func TestFixtures_RoundTrip(t *testing.T) {
	tests := []struct {
		name string
		file string
		into func() any
	}{
		{"catalog", "catalog.json", func() any { return &model.Catalog{} }},
		{"process response existing", "process-response-existing.json", func() any { return &model.ProcessResponse{} }},
		{"process response new", "process-response-new.json", func() any { return &model.ProcessResponse{} }},
		{"error no speech", "error-no-speech.json", func() any { return &model.ErrorResponse{} }},
		{"error unauthorized", "error-unauthorized.json", func() any { return &model.ErrorResponse{} }},
		{"health response", "health-response.json", func() any { return &model.HealthResponse{} }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			original, err := os.ReadFile(filepath.Join("..", "..", "..", "api", "testdata", tt.file))
			require.NoError(t, err)
			got := tt.into()

			// when
			decoder := json.NewDecoder(bytes.NewReader(original))
			decoder.DisallowUnknownFields()
			require.NoError(t, decoder.Decode(got))
			reencoded, err := json.Marshal(got)
			require.NoError(t, err)

			// then
			assert.JSONEq(t, string(original), string(reencoded))
		})
	}
}
