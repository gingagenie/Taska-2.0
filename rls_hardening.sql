BEGIN;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','jobs','job_notes','job_assignments',
    'invoices','invoice_items','quotes','quote_items',
    'files','equipment','job_notifications'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='org_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN org_id uuid;', t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=t AND indexname=t||'_org_id_idx') THEN
        EXECUTE format('CREATE INDEX %I ON public.%I (org_id);', t||'_org_id_idx', t);
      END IF;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', t);

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='p_'||t||'_sel') THEN
        EXECUTE format('CREATE POLICY p_%s_sel ON public.%I FOR SELECT USING (org_id = current_setting(''app.current_org'')::uuid);', t, t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='p_'||t||'_ins') THEN
        EXECUTE format('CREATE POLICY p_%s_ins ON public.%I FOR INSERT WITH CHECK (org_id = current_setting(''app.current_org'')::uuid);', t, t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='p_'||t||'_upd') THEN
        EXECUTE format('CREATE POLICY p_%s_upd ON public.%I FOR UPDATE USING (org_id = current_setting(''app.current_org'')::uuid) WITH CHECK (org_id = current_setting(''app.current_org'')::uuid);', t, t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='p_'||t||'_del') THEN
        EXECUTE format('CREATE POLICY p_%s_del ON public.%I FOR DELETE USING (org_id = current_setting(''app.current_org'')::uuid);', t, t);
      END IF;
    END IF;
  END LOOP;
END$$;
COMMIT;
