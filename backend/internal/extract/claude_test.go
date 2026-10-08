package extract_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/extract"
	"github.com/tahardi/dig-days/backend/internal/llm"
	"github.com/tahardi/dig-days/backend/internal/model"
	"github.com/tahardi/dig-days/backend/mocks"
)

var errClient = errors.New("client failed")

const transcript = "I worked on the second step-up for White Wolf today."

func loadResponse(t *testing.T) model.ProcessResponse {
	t.Helper()
	data, err := os.ReadFile("../../../api/testdata/process-response-existing.json")
	require.NoError(t, err)
	var resp model.ProcessResponse
	require.NoError(t, json.Unmarshal(data, &resp))
	return resp
}

func structuredReturning(draft *model.Draft, err error) func(
	context.Context,
	string,
	string,
	map[string]any,
	any,
) error {
	return func(_ context.Context, _ string, _ string, _ map[string]any, out any) error {
		if target, ok := out.(*model.Draft); ok && draft != nil {
			*target = *draft
		}
		return err
	}
}

func TestClaude_Extract(t *testing.T) {
	catalog := loadCatalog(t)
	existing := loadResponse(t).Draft
	invalidTrail := existing
	invalidTrail.Trail = model.Ref{ExistingID: new(int64(99))}
	invalidTrail.Feature = model.Ref{}
	clearedTrail := invalidTrail
	clearedTrail.Trail = model.Ref{}
	clearedTrail.Notes = "trail id 99 not found"

	tests := []struct {
		name      string
		draft     *model.Draft
		clientErr error
		want      model.Draft
		wantErr   error
	}{
		{
			name:  "happy path - returns draft",
			draft: &existing,
			want:  existing,
		},
		{
			name:  "happy path - validation applied",
			draft: &invalidTrail,
			want:  clearedTrail,
		},
		{
			name:      "error - refusal",
			clientErr: llm.ErrRefused,
			wantErr:   llm.ErrRefused,
		},
		{
			name:      "error - invalid json",
			clientErr: llm.ErrInvalidResponse,
			wantErr:   llm.ErrInvalidResponse,
		},
		{
			name:      "error - client failure",
			clientErr: errClient,
			wantErr:   errClient,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			client := mocks.NewClient(t)
			client.EXPECT().
				Structured(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				RunAndReturn(structuredReturning(tt.draft, tt.clientErr))
			claude := extract.NewClaude(client)

			// when
			got, err := claude.Extract(t.Context(), transcript, catalog)

			// then
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}

	t.Run("happy path - client arguments", func(t *testing.T) {
		// given
		catalogJSON, err := json.Marshal(catalog)
		require.NoError(t, err)
		wantUser := "Catalog:\n" + string(catalogJSON) + "\n\nTranscript:\n" + transcript
		client := mocks.NewClient(t)
		client.EXPECT().
			Structured(mock.Anything, mock.Anything, wantUser, extract.DraftSchema, mock.Anything).
			RunAndReturn(structuredReturning(&existing, nil))
		claude := extract.NewClaude(client)

		// when
		_, err = claude.Extract(t.Context(), transcript, catalog)

		// then
		require.NoError(t, err)
	})
}
