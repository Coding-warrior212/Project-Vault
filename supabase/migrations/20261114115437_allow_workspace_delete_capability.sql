-- Allow the actor-bound workspace deletion capability.
-- Preserve all existing internal operation capabilities.

ALTER TABLE private.operation_capabilities
  DROP CONSTRAINT operation_capabilities_operation_check;

ALTER TABLE private.operation_capabilities
  ADD CONSTRAINT operation_capabilities_operation_check
  CHECK (
    operation = ANY (
      ARRAY[
        'seed',
        'owner_management',
        'system_event',
        'claim_cleanup',
        'invite_redeem',
        'invite_revoke',
        'workspace_delete'
      ]::text[]
    )
  );
