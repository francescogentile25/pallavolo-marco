begin;
delete from public.matches where id = 'f3000000-0000-0000-0000-000000000003';
delete from public.courts where id = 'f3000000-0000-0000-0000-000000000002';
delete from public.venues where id = 'f3000000-0000-0000-0000-000000000001';
commit;

select json_build_object(
  'matches', (select count(*) from public.matches where id = 'f3000000-0000-0000-0000-000000000003'),
  'courts', (select count(*) from public.courts where id = 'f3000000-0000-0000-0000-000000000002'),
  'venues', (select count(*) from public.venues where id = 'f3000000-0000-0000-0000-000000000001')
) as remaining_fixture_rows;
