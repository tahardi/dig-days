package extract

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/tahardi/dig-days/backend/internal/model"
)

const maxTokens = 2000

var (
	ErrRefused         = errors.New("refusing request")
	ErrInvalidResponse = errors.New("parsing model response")
)

type Claude struct {
	client anthropic.Client
}

func NewClaude(client anthropic.Client) Claude {
	return Claude{client: client}
}

func (c Claude) Extract(ctx context.Context, transcript string, catalog model.Catalog) (model.Draft, error) {
	catalogJSON, err := json.Marshal(catalog)
	if err != nil {
		return model.Draft{}, fmt.Errorf("marshaling catalog: %w", err)
	}
	userMessage := "Catalog:\n" + string(catalogJSON) + "\n\nTranscript:\n" + transcript

	message, err := c.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     anthropic.ModelClaudeOpus5,
		MaxTokens: maxTokens,
		System:    []anthropic.BetaTextBlockParam{{Text: systemPrompt}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(userMessage)),
		},
		Betas: []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_06_01},
		Fallbacks: anthropic.BetaFallbacksParamUnion{
			OfBetaFallbackArray: []anthropic.BetaFallbackParam{{Model: anthropic.ModelClaudeOpus4_8}},
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortLow,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: draftSchema},
		},
	})
	if err != nil {
		return model.Draft{}, fmt.Errorf("calling claude: %w", err)
	}
	if message.StopReason == anthropic.BetaStopReasonRefusal {
		return model.Draft{}, ErrRefused
	}

	var text strings.Builder
	for _, block := range message.Content {
		if block.Type == "text" {
			text.WriteString(block.AsText().Text)
		}
	}

	var draft model.Draft
	if err = json.Unmarshal([]byte(text.String()), &draft); err != nil {
		return model.Draft{}, fmt.Errorf("%w: %w", ErrInvalidResponse, err)
	}
	return Validate(draft, catalog), nil
}
