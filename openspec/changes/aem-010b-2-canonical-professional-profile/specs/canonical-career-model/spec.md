## ADDED Requirements

### Requirement: Candidate presentation metadata is not evidence
The canonical career model SHALL associate the allowlisted `professional-profile/v1` Candidate fields with the `professional_profile` asset as presentation metadata and MUST NOT create `EvidenceClaim` records for those field values. Professional facts in evidence-bearing sections SHALL continue to require source references and evidence claims under the existing canonical model.

#### Scenario: Candidate header is ingested
- **WHEN** a canonical profile supplies Name, Headline, Location, Email, Phone, or profile links
- **THEN** those values are available as provenance-bearing presentation metadata and no evidence claim is created merely to represent a header or contact value

#### Scenario: Professional experience is ingested
- **WHEN** the same canonical profile supplies supported Professional Experience facts
- **THEN** those facts are modeled as professional assets and atomic evidence claims with source references rather than presentation metadata

#### Scenario: Presentation metadata is reviewed
- **WHEN** claim reconciliation lists evidence claims from a canonical profile
- **THEN** Candidate contact and header fields are absent from the claim-review queue while evidence-bearing professional facts remain eligible

