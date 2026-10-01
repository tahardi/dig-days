package model

import "context"

type Extractor interface {
	Extract(ctx context.Context, transcript string, catalog Catalog) (Draft, error)
}
