-- BKG-06: dashboard seated/no-show actions. Deliberately scoped to just
-- these two status values — BKG-01's capacity/waitlist model and BKG-03's
-- staff-confirm mode aren't built (capture-and-notify-staff only, per this
-- project's earlier confirmed decision), so there's no "confirm/decline"
-- action here and no capacity indicator to show.
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending','confirmed','cancelled','seated','no_show'));
