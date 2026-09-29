package config_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/config"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    config.Config
		wantErr error
	}{
		{
			name: "all vars set",
			env: map[string]string{
				"LISTEN_ADDR":       "0.0.0.0:9000",
				"DIGDAYS_KEY":       "secret",
				"ANTHROPIC_API_KEY": "anthropic",
				"WHISPER_BIN":       "/bin/whisper",
				"WHISPER_MODEL":     "/models/base.bin",
				"FFMPEG_BIN":        "/bin/ffmpeg",
			},
			want: config.Config{
				ListenAddr:      "0.0.0.0:9000",
				Key:             "secret",
				AnthropicAPIKey: "anthropic",
				WhisperBin:      "/bin/whisper",
				WhisperModel:    "/models/base.bin",
				FFmpegBin:       "/bin/ffmpeg",
			},
		},
		{
			name: "only key set applies defaults",
			env:  map[string]string{"DIGDAYS_KEY": "secret"},
			want: config.Config{
				ListenAddr: "127.0.0.1:8080",
				Key:        "secret",
				WhisperBin: "whisper-cli",
				FFmpegBin:  "ffmpeg",
			},
		},
		{
			name:    "error - empty key",
			env:     map[string]string{"DIGDAYS_KEY": ""},
			wantErr: config.ErrMissingKey,
		},
		{
			name:    "error - whitespace key",
			env:     map[string]string{"DIGDAYS_KEY": "   "},
			wantErr: config.ErrMissingKey,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			getenv := func(name string) string { return tt.env[name] }

			// when
			got, err := config.Load(getenv)

			// then
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
