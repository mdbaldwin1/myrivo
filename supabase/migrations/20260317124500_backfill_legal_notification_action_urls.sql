update public.notifications
set action_url = '/legal/consent?versionId=' || (metadata ->> 'legalVersionId')
where event_type = 'legal.update.required'
  and coalesce(metadata ->> 'legalVersionId', '') <> ''
  and (
    action_url is null
    or action_url = '/legal/consent'
    or action_url not like '/legal/consent?versionId=%'
  );
