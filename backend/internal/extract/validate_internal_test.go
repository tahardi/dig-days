package extract

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/dig-days/backend/internal/model"
)

func TestResolveRef(t *testing.T) {
	entries := []entry{{id: 1, name: "White Wolf"}, {id: 2, name: "Ridgeback"}}
	tests := []struct {
		name        string
		ref         model.Ref
		entries     []entry
		want        model.Ref
		wantMissing bool
	}{
		{"empty ref stays empty", model.Ref{}, entries, model.Ref{}, false},
		{
			"known id is kept",
			model.Ref{ExistingID: new(int64(2))},
			entries,
			model.Ref{ExistingID: new(int64(2))},
			false,
		},
		{"unknown id is cleared and reported", model.Ref{ExistingID: new(int64(9))}, entries, model.Ref{}, true},
		{
			"unknown id keeps trimmed new name",
			model.Ref{ExistingID: new(int64(9)), NewName: new(" Fresh ")},
			entries,
			model.Ref{NewName: new("Fresh")},
			true,
		},
		{
			"known id wins over new name",
			model.Ref{ExistingID: new(int64(1)), NewName: new("Ridgeback")},
			entries,
			model.Ref{ExistingID: new(int64(1))},
			false,
		},
		{
			"new name matches entry ignoring case and spaces",
			model.Ref{NewName: new("  ridgeBACK ")},
			entries,
			model.Ref{ExistingID: new(int64(2))},
			false,
		},
		{
			"unmatched new name is trimmed",
			model.Ref{NewName: new("  Fresh ")},
			entries,
			model.Ref{NewName: new("Fresh")},
			false,
		},
		{"blank new name becomes nil", model.Ref{NewName: new("   ")}, entries, model.Ref{}, false},
		{"id with no entries is cleared and reported", model.Ref{ExistingID: new(int64(1))}, nil, model.Ref{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// when
			got, missing := resolveRef(tt.ref, tt.entries)

			// then
			assert.Equal(t, tt.want, got)
			assert.Equal(t, tt.wantMissing, missing)
		})
	}
}

func TestCleanTools(t *testing.T) {
	known := []string{"rock bar", "sledge", "McLeod"}
	tests := []struct {
		name  string
		tools []string
		known []string
		want  []string
	}{
		{"nil becomes empty", nil, known, []string{}},
		{"blanks are dropped", []string{"", "  "}, known, []string{}},
		{"names are trimmed", []string{"  shovel "}, known, []string{"shovel"}},
		{"catalog spelling is used", []string{"MCLEOD", "Rock Bar"}, known, []string{"McLeod", "rock bar"}},
		{"duplicates keep first ignoring case", []string{"shovel", "SHOVEL", "Shovel"}, known, []string{"shovel"}},
		{"duplicates collapse after catalog spelling", []string{"mcleod", "McLeod"}, known, []string{"McLeod"}},
		{"order is kept", []string{"b", "a", "c"}, nil, []string{"b", "a", "c"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// when
			got := cleanTools(tt.tools, tt.known)

			// then
			assert.Equal(t, tt.want, got)
		})
	}
}
