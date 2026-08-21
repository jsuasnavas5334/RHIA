BEGIN;

INSERT INTO rhia.outreach_policy (
  id, organization_id, version, name, configuration, status
)
VALUES (
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000001',
  '1.0',
  'Outreach Policy v1',
  '{
    "maxProactiveTouches": 3,
    "cadenceBusinessDays": [0, 3, 7],
    "contactWindow": {"startHour": 8, "endHour": 20},
    "stopSignals": ["REPLY", "MEETING_BOOKED", "OPT_OUT", "PERMANENT_BOUNCE", "RISK"],
    "retryUsesSameIdempotencyKey": true,
    "timezoneSource": "SEQUENCE"
  }'::jsonb,
  'DRAFT'
)
ON CONFLICT (organization_id, version) DO NOTHING;

COMMIT;
