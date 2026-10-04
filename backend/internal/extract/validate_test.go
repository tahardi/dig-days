package extract_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/dig-days/backend/internal/extract"
	"github.com/tahardi/dig-days/backend/internal/model"
)

func loadCatalog(t *testing.T) model.Catalog {
	t.Helper()
	data, err := os.ReadFile("../../../api/testdata/catalog.json")
	require.NoError(t, err)
	var catalog model.Catalog
	require.NoError(t, json.Unmarshal(data, &catalog))
	return catalog
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name  string
		draft model.Draft
		want  model.Draft
	}{
		{
			"trail id not in catalog is cleared with note",
			model.Draft{Trail: model.Ref{ExistingID: new(int64(99))}, Tools: []string{}},
			model.Draft{Tools: []string{}, Notes: "trail id 99 not found"},
		},
		{
			"both ids and names keeps existing id",
			model.Draft{Trail: model.Ref{ExistingID: new(int64(2)), NewName: new("Other")}, Tools: []string{}},
			model.Draft{Trail: model.Ref{ExistingID: new(int64(2))}, Tools: []string{}},
		},
		{
			"trail new name matches existing trail",
			model.Draft{Trail: model.Ref{NewName: new("  white wolf ")}, Tools: []string{}},
			model.Draft{Trail: model.Ref{ExistingID: new(int64(1))}, Tools: []string{}},
		},
		{
			"feature id not on trail is cleared with note",
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(2))},
				Feature: model.Ref{ExistingID: new(int64(1))},
				Tools:   []string{},
			},
			model.Draft{
				Trail: model.Ref{ExistingID: new(int64(2))},
				Tools: []string{},
				Notes: "feature id 1 not on trail",
			},
		},
		{
			"feature id on new trail is cleared with note",
			model.Draft{
				Trail:   model.Ref{NewName: new("Fresh")},
				Feature: model.Ref{ExistingID: new(int64(1))},
				Tools:   []string{},
			},
			model.Draft{
				Trail: model.Ref{NewName: new("Fresh")},
				Tools: []string{},
				Notes: "feature id 1 not on trail",
			},
		},
		{
			"feature id on unset trail is cleared with note",
			model.Draft{Feature: model.Ref{ExistingID: new(int64(1))}, Tools: []string{}},
			model.Draft{Tools: []string{}, Notes: "feature id 1 not on trail"},
		},
		{
			"feature new name matches feature on chosen trail",
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(1))},
				Feature: model.Ref{NewName: new("step-up #2")},
				Tools:   []string{},
			},
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(1))},
				Feature: model.Ref{ExistingID: new(int64(2))},
				Tools:   []string{},
			},
		},
		{
			"feature new name is not matched against other trails",
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(2))},
				Feature: model.Ref{NewName: new("Step-up #1")},
				Tools:   []string{},
			},
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(2))},
				Feature: model.Ref{NewName: new("Step-up #1")},
				Tools:   []string{},
			},
		},
		{
			"new names are trimmed and blank becomes nil",
			model.Draft{
				Trail:   model.Ref{NewName: new("  Fresh  ")},
				Feature: model.Ref{NewName: new("   ")},
				Tools:   []string{},
			},
			model.Draft{Trail: model.Ref{NewName: new("Fresh")}, Tools: []string{}},
		},
		{
			"tools are cleaned",
			model.Draft{Tools: []string{" ROCK BAR ", "", "  ", "rock bar", "shovel", "Shovel", "mcleod"}},
			model.Draft{Tools: []string{"rock bar", "shovel", "McLeod"}},
		},
		{
			"nil tools become empty",
			model.Draft{},
			model.Draft{Tools: []string{}},
		},
		{
			"negative break becomes zero",
			model.Draft{BreakMinutes: -5, Tools: []string{}},
			model.Draft{Tools: []string{}},
		},
		{
			"notes are joined onto existing notes",
			model.Draft{
				Trail: model.Ref{ExistingID: new(int64(99))},
				Tools: []string{},
				Notes: "unsure match",
			},
			model.Draft{Tools: []string{}, Notes: "unsure match; trail id 99 not found"},
		},
		{
			"review focus - new name white wolf becomes existing id 1",
			model.Draft{Trail: model.Ref{NewName: new("white wolf")}, Tools: []string{}},
			model.Draft{Trail: model.Ref{ExistingID: new(int64(1))}, Tools: []string{}},
		},
		{
			"review focus - feature id 1 with trail id 2 is cleared",
			model.Draft{
				Trail:   model.Ref{ExistingID: new(int64(2))},
				Feature: model.Ref{ExistingID: new(int64(1))},
				Tools:   []string{},
			},
			model.Draft{
				Trail: model.Ref{ExistingID: new(int64(2))},
				Tools: []string{},
				Notes: "feature id 1 not on trail",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			catalog := loadCatalog(t)
			input, err := json.Marshal(tt.draft)
			require.NoError(t, err)

			// when
			got := extract.Validate(tt.draft, catalog)

			// then
			assert.Equal(t, tt.want, got)
			after, err := json.Marshal(tt.draft)
			require.NoError(t, err)
			assert.JSONEq(t, string(input), string(after))
		})
	}
}
