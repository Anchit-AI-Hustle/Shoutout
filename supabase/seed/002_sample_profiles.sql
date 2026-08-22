-- Sample profiles for both sides of the marketplace.
--
-- Fictional acts and companies, deliberately. Publishing a real artist's
-- name, photo and discography on a booking platform asserts they are
-- available to hire — a claim about a person who never agreed to it, using
-- media that isn't ours. Every column below is the real schema, so genuine
-- profiles populate it identically the moment someone signs up.
--
-- Images: picsum.photos, a free placeholder service, deterministic by seed.
-- Audio: SoundHelix demo tracks, published by their author for testing.

do $$
declare
  a record; e record; v_org uuid; v_artist uuid; v_prof uuid; i int;
begin
  for a in
    select * from (values
      ('aarav-mehta','Aarav Mehta','Mumbai',array['indie-pop','alt-rock'],array['vocalist','songwriter','guitar'],
       'Bombay indie songwriter. Writes in Hindi and English, plays with a four-piece, tours the college circuit.',true,true),
      ('noor-fatima','Noor Fatima','Delhi',array['sufi','ghazal','indie-folk'],array['vocalist','topliner','songwriter'],
       'Trained in Hindustani classical, sings Sufi and ghazal with contemporary arrangement.',true,false),
      ('rhythm-collective','Rhythm Collective','Bengaluru',array['fusion','carnatic','jazz'],array['live_band_member','tabla','percussion'],
       'Six-piece Carnatic-jazz fusion outfit. Regulars on the Bengaluru club circuit and the festival stage.',true,true),
      ('kavya-iyer','Kavya Iyer','Chennai',array['carnatic','film','devotional'],array['vocalist','harmony_singer','composer'],
       'Playback and concert vocalist. Carnatic training, film sessions, a steady wedding-season calendar.',false,false),
      ('bass-tapes','Bass Tapes','Goa',array['electronic','techno','bass'],array['dj','beat_producer','sound_designer'],
       'Goa-based DJ and producer. Bass-heavy sets, original productions, a residency on the north coast.',true,true),
      ('mira-sen','Mira Sen','Kolkata',array['rabindrasangeet','indie-folk'],array['vocalist','songwriter','lyricist'],
       'Rabindrasangeet reinterpreted with contemporary arrangement. Plays across the east.',true,false),
      ('tanpura-project','The Tanpura Project','Pune',array['experimental','ambient','classical-fusion'],array['instrumental_producer','sitar','arranger'],
       'Sitar and modular synth. Long-form ambient sets built on classical ragas.',false,true),
      ('harleen-kaur','Harleen Kaur','Jaipur',array['folk','rajasthani','wedding'],array['vocalist','live_band_member'],
       'Rajasthani folk with a full band. Weddings, palace events and festival stages across the north-west.',true,false)
    ) as t(slug,name,city,genres,roles,bio,verified,fee_visible)
  loop
    insert into orgs (name, type, plan_tier) values (a.name, 'self', 'free') returning id into v_org;
    insert into artists (org_id, stage_name, slug, home_city, genres, bio, verified, fee_band_visible)
      values (v_org, a.name, a.slug, a.city, a.genres, a.bio, a.verified, a.fee_visible)
      returning id into v_artist;

    insert into artist_roles (artist_id, org_id, role, attributes, active)
      select v_artist, v_org, r, '{}'::jsonb, true from unnest(a.roles) as r;

    insert into artist_media (org_id, artist_id, kind, url, title, is_primary, sort_order) values
      (v_org, v_artist, 'image', 'https://picsum.photos/seed/'||a.slug||'/800/800', 'Press shot', true, 0),
      (v_org, v_artist, 'image', 'https://picsum.photos/seed/'||a.slug||'-live/800/600', 'Live', false, 1),
      (v_org, v_artist, 'image', 'https://picsum.photos/seed/'||a.slug||'-studio/800/600', 'In the studio', false, 2);
  end loop;
end $$;
