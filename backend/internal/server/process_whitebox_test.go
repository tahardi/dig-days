package server

import (
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const boundary = "testboundary"

func field(name string, filename string, value string) string {
	disposition := `Content-Disposition: form-data; name="` + name + `"`
	if filename != "" {
		disposition += `; filename="` + filename + `"`
	}
	return "--" + boundary + "\r\n" + disposition + "\r\n\r\n" + value + "\r\n"
}

func closing() string {
	return "--" + boundary + "--\r\n"
}

func TestReadParts(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		limit       int64
		wantAudio   string
		wantCatalog string
		wantErr     bool
		wantPartial bool
		wantTooBig  bool
	}{
		{
			name:        "happy path - audio and catalog",
			body:        field("audio", "clip.m4a", "sound") + field("catalog", "", `{"a":1}`) + closing(),
			wantAudio:   "sound",
			wantCatalog: `{"a":1}`,
		},
		{
			name:        "happy path - catalog before audio",
			body:        field("catalog", "", `{"a":1}`) + field("audio", "clip.m4a", "sound") + closing(),
			wantAudio:   "sound",
			wantCatalog: `{"a":1}`,
		},
		{
			name:      "happy path - audio only",
			body:      field("audio", "clip.m4a", "sound") + closing(),
			wantAudio: "sound",
		},
		{
			name:        "happy path - catalog only",
			body:        field("catalog", "", "{}") + closing(),
			wantCatalog: "{}",
		},
		{
			name:        "happy path - unknown part ignored",
			body:        field("other", "", "x") + field("catalog", "", "{}") + closing(),
			wantCatalog: "{}",
		},
		{
			name: "happy path - empty body",
			body: closing(),
		},
		{
			name:      "error - truncated audio keeps path for cleanup",
			body:      field("audio", "clip.m4a", "sound"),
			wantAudio: "sound",
			wantErr:   true,
		},
		{
			name:        "error - body over limit",
			body:        field("audio", "clip.m4a", strings.Repeat("x", 200)) + closing(),
			limit:       100,
			wantErr:     true,
			wantTooBig:  true,
			wantPartial: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			var body io.Reader = strings.NewReader(tt.body)
			if tt.limit > 0 {
				body = http.MaxBytesReader(httptest.NewRecorder(), io.NopCloser(body), tt.limit)
			}
			reader := multipart.NewReader(body, boundary)

			// when
			audioPath, catalogJSON, err := readParts(reader)

			// then
			if audioPath != "" {
				t.Cleanup(func() { _ = os.Remove(audioPath) })
			}
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if tt.wantTooBig {
				_, ok := errors.AsType[*http.MaxBytesError](err)
				assert.True(t, ok)
			}
			assert.Equal(t, []byte(tt.wantCatalog), append([]byte{}, catalogJSON...))
			if tt.wantPartial {
				assert.FileExists(t, audioPath)
				return
			}
			if tt.wantAudio == "" {
				assert.Empty(t, audioPath)
				return
			}
			got, readErr := os.ReadFile(audioPath)
			require.NoError(t, readErr)
			assert.Equal(t, tt.wantAudio, string(got))
		})
	}
}
