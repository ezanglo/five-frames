-- Sales-led launch (decision D23, product.md §7.2.1): hosts pay FiveFrames directly, often by
-- GCash or Maya transfer. Record that as its own manual payment method instead of 'other', so the
-- Operator Console ledger can tell e-wallet receipts apart from cash and bank transfers.
--
-- Additive: widens the allowed values only. Every existing row already satisfies the new check,
-- and old application code never writes 'e_wallet'.

alter table public.payments
  drop constraint if exists payments_manual_method_check;

alter table public.payments
  add constraint payments_manual_method_check
    check (manual_method in ('cash', 'bank_transfer', 'e_wallet', 'other'));
