package extract

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tahardi/dig-days/backend/internal/llm"
	"github.com/tahardi/dig-days/backend/internal/model"
)

type Claude struct {
	client llm.Client
}

func NewClaude(client llm.Client) Claude {
	return Claude{client: client}
}

func (c Claude) Extract(ctx context.Context, transcript string, catalog model.Catalog) (model.Draft, error) {
	catalogJSON, err := json.Marshal(catalog)
	if err != nil {
		return model.Draft{}, fmt.Errorf("marshaling catalog: %w", err)
	}
	userMessage := "Catalog:\n" + string(catalogJSON) + "\n\nTranscript:\n" + transcript

	var draft model.Draft
	if err = c.client.Structured(ctx, systemPrompt, userMessage, draftSchema, &draft); err != nil {
		return model.Draft{}, err
	}
	return Validate(draft, catalog), nil
}
