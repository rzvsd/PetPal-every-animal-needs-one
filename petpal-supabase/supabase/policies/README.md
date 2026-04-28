# RLS Policy Notes

Initial implementation should create policies with these guarantees:

- Profiles are readable by authenticated users, but only owners can update themselves.
- Organizations are public only through safe display fields.
- Organization members can manage their organization's animals and listings.
- Public discovery reads from `listing_public_view`.
- Applications are readable by the applicant and the listing organization only.
- Conversations and messages are readable only by participants.
- Reports are readable only by admins and their reporter.
- Audit logs are admin-only.

