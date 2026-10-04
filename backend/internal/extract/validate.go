package extract

import (
	"fmt"
	"strings"

	"github.com/tahardi/dig-days/backend/internal/model"
)

const noteSeparator = "; "

type entry struct {
	id   int64
	name string
}

func Validate(draft model.Draft, catalog model.Catalog) model.Draft {
	var notes []string

	trailEntries := make([]entry, 0, len(catalog.Trails))
	for _, trail := range catalog.Trails {
		trailEntries = append(trailEntries, entry{id: trail.ID, name: trail.Name})
	}
	trail, trailMissing := resolveRef(draft.Trail, trailEntries)
	if trailMissing {
		notes = append(notes, fmt.Sprintf("trail id %d not found", *draft.Trail.ExistingID))
	}

	var featureEntries []entry
	if trail.ExistingID != nil {
		for _, t := range catalog.Trails {
			if t.ID != *trail.ExistingID {
				continue
			}
			for _, feature := range t.Features {
				featureEntries = append(featureEntries, entry{id: feature.ID, name: feature.Name})
			}
		}
	}
	feature, featureMissing := resolveRef(draft.Feature, featureEntries)
	if featureMissing {
		notes = append(notes, fmt.Sprintf("feature id %d not on trail", *draft.Feature.ExistingID))
	}

	draft.Trail = trail
	draft.Feature = feature
	draft.Tools = cleanTools(draft.Tools, catalog.Tools)
	draft.BreakMinutes = max(draft.BreakMinutes, 0)
	if draft.Notes != "" {
		notes = append([]string{draft.Notes}, notes...)
	}
	draft.Notes = strings.Join(notes, noteSeparator)
	return draft
}

func resolveRef(ref model.Ref, entries []entry) (model.Ref, bool) {
	var out model.Ref
	missing := false

	if ref.NewName != nil {
		if name := strings.TrimSpace(*ref.NewName); name != "" {
			out.NewName = &name
		}
	}

	if ref.ExistingID != nil {
		found := false
		for _, e := range entries {
			if e.id == *ref.ExistingID {
				found = true
				break
			}
		}
		if found {
			id := *ref.ExistingID
			out.ExistingID = &id
			out.NewName = nil
		} else {
			missing = true
		}
	}

	if out.ExistingID == nil && out.NewName != nil {
		for _, e := range entries {
			if strings.EqualFold(e.name, *out.NewName) {
				id := e.id
				out.ExistingID = &id
				out.NewName = nil
				break
			}
		}
	}
	return out, missing
}

func cleanTools(tools []string, known []string) []string {
	out := make([]string, 0, len(tools))
	seen := make(map[string]bool, len(tools))
	for _, tool := range tools {
		tool = strings.TrimSpace(tool)
		if tool == "" {
			continue
		}
		for _, k := range known {
			if strings.EqualFold(k, tool) {
				tool = k
				break
			}
		}
		key := strings.ToLower(tool)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, tool)
	}
	return out
}
