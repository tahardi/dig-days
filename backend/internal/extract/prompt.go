package extract

const systemPrompt = `You turn a trail builder's spoken work summary into a structured work log entry.
You receive the transcript and a catalog of the builder's existing trails, their features, and tool names.
Match the transcript to an existing trail and feature when it clearly refers to one, even if phrased differently
("the second step-up" can match "Step-up #2"). Use existing_id for matches. Propose new_name only when nothing
in the catalog matches. Leave feature fields null when the work was general trail work, not on a specific feature.
Write summary as one or two plain sentences of what was done. List tools mentioned, using the catalog's spelling
when a tool matches. Set break_minutes only when the builder mentions a break; otherwise 0.
Use notes to explain any uncertain match in one short sentence; otherwise an empty string.`

var draftSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"trail", "feature", "summary", "tools", "break_minutes", "notes"},
	"properties": map[string]any{
		"trail":         map[string]any{"$ref": "#/$defs/ref"},
		"feature":       map[string]any{"$ref": "#/$defs/ref"},
		"summary":       map[string]any{"type": "string"},
		"tools":         map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		"break_minutes": map[string]any{"type": "integer"},
		"notes":         map[string]any{"type": "string"},
	},
	"$defs": map[string]any{
		"ref": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []string{"existing_id", "new_name"},
			"properties": map[string]any{
				"existing_id": map[string]any{"type": []string{"integer", "null"}},
				"new_name":    map[string]any{"type": []string{"string", "null"}},
			},
		},
	},
}
