# Open questions

- Final dealership inventory adapter contracts remain to be defined in later phases.
- Which authoritative SRS/SAD authentication requirements and identifiers govern Day 4? The referenced documents were not available in the repository.
- Which production identity provider, if any, is approved? The current local password/session implementation is not production-ready.
- What production email provider, verified sender/domain, delivery monitoring, and abuse policy should be used for verification, password reset, and invitations?
- What is the approved first-dealership and initial-administrator bootstrap process? Public registration and an admin seed are intentionally absent.
- Which dealership/global role keys and exact permission catalog are approved? Current staff permission strings and privileged-role matches are provisional and are not seeded.
- What password policy, MFA recovery process, account recovery policy, session duration, and administrator review workflow are required?
- Should role/branch changes revoke all sessions across all dealership memberships, or should sessions be dealership-bound?
- Does production require device/session listing, concurrent-session limits, and security-event alerting?
- AI service integrations remain out of scope for Day 2.
