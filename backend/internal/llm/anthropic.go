package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const maxTokens = 2000

type Anthropic struct {
	client anthropic.Client
}

func NewAnthropic(apiKey string, opts ...option.RequestOption) *Anthropic {
	allOpts := append([]option.RequestOption{option.WithAPIKey(apiKey)}, opts...)
	return &Anthropic{client: anthropic.NewClient(allOpts...)}
}

func (a *Anthropic) Structured(
	ctx context.Context,
	system string,
	user string,
	schema map[string]any,
	out any,
) error {
	message, err := a.client.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     anthropic.ModelClaudeOpus5,
		MaxTokens: maxTokens,
		System:    []anthropic.BetaTextBlockParam{{Text: system}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(user)),
		},
		Betas: []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_06_01},
		Fallbacks: anthropic.BetaFallbacksParamUnion{
			OfBetaFallbackArray: []anthropic.BetaFallbackParam{{Model: anthropic.ModelClaudeOpus4_8}},
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortLow,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: schema},
		},
	})
	if err != nil {
		return fmt.Errorf("calling claude: %w", err)
	}
	if message.StopReason == anthropic.BetaStopReasonRefusal {
		return ErrRefused
	}

	var text strings.Builder
	for _, block := range message.Content {
		if block.Type == "text" {
			text.WriteString(block.AsText().Text)
		}
	}

	if err = json.Unmarshal([]byte(text.String()), out); err != nil {
		return fmt.Errorf("%w: %w", ErrInvalidResponse, err)
	}
	return nil
}
