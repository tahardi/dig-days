package model

type Feature struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Trail struct {
	ID       int64     `json:"id"`
	Name     string    `json:"name"`
	Features []Feature `json:"features"`
}

type Catalog struct {
	Trails []Trail  `json:"trails"`
	Tools  []string `json:"tools"`
}

type Ref struct {
	ExistingID *int64  `json:"existing_id"`
	NewName    *string `json:"new_name"`
}

type Draft struct {
	Trail        Ref      `json:"trail"`
	Feature      Ref      `json:"feature"`
	Summary      string   `json:"summary"`
	Tools        []string `json:"tools"`
	BreakMinutes int      `json:"break_minutes"`
	Notes        string   `json:"notes"`
}

type ProcessResponse struct {
	Transcript string `json:"transcript"`
	Draft      Draft  `json:"draft"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type HealthResponse struct {
	Status string `json:"status"`
}
