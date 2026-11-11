-- Sample content. Facts are brief summaries; verify and expand with sources before public launch.
TRUNCATE scenes, media, events, destinations, eras, predictions, quiz_questions RESTART IDENTITY CASCADE;

INSERT INTO eras (name, start_year, end_year, description) VALUES
('Bronze Age Civilizations', -3300, -1200, 'Early river-valley civilizations, monumental building and the first cities.'),
('Classical Antiquity', -800, 476, 'The age of Greece and Rome, and the great empires of the ancient world.'),
('Medieval Era', 477, 1499, 'Kingdoms, empires, trade networks and cultural flowering across Europe, Asia and the Americas.'),
('Early Modern Era', 1500, 1799, 'Gunpowder empires, global exploration and the rise of the modern state.'),
('Modern Era', 1800, 2026, 'Industrialisation, world wars, decolonisation and the digital age.');

INSERT INTO destinations (name, country, description, era_id) VALUES
('Lahore', 'Pakistan', 'A historic city of Punjab, home to the Lahore Fort, Badshahi Mosque and the walled city, and today a major cultural and economic centre of Pakistan.', 5),
('Mohenjo-daro', 'Pakistan', 'An archaeological site of a large Indus Valley Civilization city in Sindh, known for its planned streets and drainage. It is a UNESCO World Heritage Site.', 1),
('Giza', 'Egypt', 'Home of the Great Pyramid, the Sphinx and neighbouring pyramids on the edge of Cairo, and one of the most visited ancient sites in the world.', 1),
('Rome', 'Italy', 'The capital of Italy and of the ancient Roman Republic and Empire, where ruins such as the Colosseum and Forum sit inside a living modern city.', 2),
('Kyoto', 'Japan', 'Japan''s imperial capital for over a thousand years, famous for temples, gardens and traditional culture, and today a major cultural and tourist city.', 3),
('Machu Picchu', 'Peru', 'An Inca citadel high in the Andes, a UNESCO World Heritage Site and one of the most recognisable archaeological sites in South America.', 4),
('Paris', 'France', 'The capital of France, known for its museums, architecture and landmarks such as the Eiffel Tower.', 5);

INSERT INTO events (title, event_year, category, description, destination_id, source_url) VALUES
('Mohenjo-daro flourishes', -2500, 'Civilization', 'Around this time the Indus Valley city of Mohenjo-daro was built and grew into one of the largest settlements of its civilization, with a planned street grid and advanced drainage. Dates are approximate.', 2, 'https://en.wikipedia.org/wiki/Mohenjo-daro'),
('Great Pyramid of Giza built', -2560, 'Architecture', 'The Great Pyramid was built for the pharaoh Khufu around this time and remained the tallest human-made structure for thousands of years. The date is approximate.', 3, 'https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza'),
('Colosseum completed', 80, 'Architecture', 'The Flavian Amphitheatre, known as the Colosseum, was inaugurated in Rome under the emperor Titus and hosted public spectacles for centuries.', 4, 'https://en.wikipedia.org/wiki/Colosseum'),
('Fall of the Western Roman Empire', 476, 'Politics', 'The last western Roman emperor, Romulus Augustulus, was deposed, a date traditionally used to mark the end of the Western Roman Empire.', 4, 'https://en.wikipedia.org/wiki/Fall_of_the_Western_Roman_Empire'),
('Heian-kyo (Kyoto) becomes the capital', 794, 'Politics', 'The imperial court moved to Heian-kyo, today''s Kyoto, which remained the capital of Japan for over a thousand years.', 5, 'https://en.wikipedia.org/wiki/Kyoto'),
('Machu Picchu built', 1450, 'Civilization', 'The Inca citadel of Machu Picchu was built around this time, commonly linked to the emperor Pachacuti. The date is approximate.', 6, 'https://en.wikipedia.org/wiki/Machu_Picchu'),
('Akbar rebuilds the Lahore Fort', 1566, 'Architecture', 'The Mughal emperor Akbar had the Lahore Fort rebuilt in brick around this time; later rulers added to it over the following centuries. The date is approximate.', 1, 'https://en.wikipedia.org/wiki/Lahore_Fort'),
('Badshahi Mosque completed', 1673, 'Architecture', 'The Badshahi Mosque in Lahore was completed during the reign of Aurangzeb and was among the largest mosques in the world at the time.', 1, 'https://en.wikipedia.org/wiki/Badshahi_Mosque'),
('Eiffel Tower completed', 1889, 'Architecture', 'The Eiffel Tower was completed in Paris for the Exposition Universelle (World''s Fair), marking the centenary of the French Revolution.', 7, 'https://en.wikipedia.org/wiki/Eiffel_Tower'),
('Lahore Resolution', 1940, 'Politics', 'On 23 March 1940 the All-India Muslim League adopted the Lahore Resolution at a session in Lahore, a milestone in the movement that led to the creation of Pakistan.', 1, 'https://en.wikipedia.org/wiki/Lahore_Resolution'),
('Partition of British India', 1947, 'Politics', 'British India was partitioned into India and Pakistan in August 1947. Lahore became part of Pakistan. The partition was accompanied by mass migration and great loss of life across Punjab.', 1, 'https://en.wikipedia.org/wiki/Partition_of_India'),
('Apollo 11 Moon landing', 1969, 'Science', 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin landed on the Moon on 20 July 1969.', NULL, 'https://en.wikipedia.org/wiki/Apollo_11');

INSERT INTO predictions (title, target_year, category, description, assumptions, author, last_reviewed, confidence_level) VALUES
('Electric and autonomous transport in cities', 2035, 'transport', 'Electric vehicles could make up most new car sales in many countries, with autonomous shuttles in selected city districts.', 'Continued battery cost declines, charging infrastructure investment and supportive regulation.', 'TimeWarp Editorial', CURRENT_DATE, 'medium'),
('AI-assisted diagnostics in routine care', 2040, 'health', 'AI tools could become a routine second opinion for imaging and screening, with doctors remaining responsible for decisions.', 'Clinical validation, data privacy safeguards and regulatory approval keep pace with the technology.', 'TimeWarp Editorial', CURRENT_DATE, 'medium'),
('Renewables dominate new power generation', 2050, 'energy', 'Solar and wind could provide the largest share of new electricity capacity, supported by large-scale storage.', 'Falling costs, grid upgrades and storage deployment continue.', 'TimeWarp Editorial', CURRENT_DATE, 'medium'),
('Sustained lunar research presence', 2050, 'space', 'Several countries could maintain crewed or semi-permanent research bases near the Moon''s south pole.', 'Continued funding and international cooperation on launch and habitat technology.', 'TimeWarp Editorial', CURRENT_DATE, 'low'),
('Climate-adapted megacities', 2100, 'cities', 'Large cities may rely on cooling networks, flood defences and water reuse to adapt to a warmer climate.', 'Warming within the range projected by current climate models, and sustained adaptation spending.', 'TimeWarp Editorial', CURRENT_DATE, 'low'),
('Lahore-inspired adaptive city (fictional)', 2150, 'cities', 'A fictional vision: shaded walkable bazaars, solar canopies, elevated rail and rainwater-fed gardens keep a future Lahore comfortable during extreme heat.', 'Imaginative scenario only. Assumes strong climate adaptation, clean energy and continued urban investment.', 'TimeWarp Editorial', CURRENT_DATE, 'low'),
('Orbital habitats for research and industry', 2150, 'space', 'A fictional vision of rotating habitats in Earth orbit hosting research labs and zero-gravity manufacturing.', 'Imaginative scenario only. Assumes dramatically cheaper launch and closed-loop life support.', 'TimeWarp Editorial', CURRENT_DATE, 'low'),
('Personal AI assistants everywhere', 2100, 'ai', 'AI assistants may be built into most tools and services, with ongoing debate about work, privacy and accountability.', 'AI capability keeps improving and societies adopt rules for its safe use.', 'TimeWarp Editorial', CURRENT_DATE, 'low');

INSERT INTO quiz_questions (question, options, correct_answer, explanation, difficulty) VALUES
('Which civilization built the city of Mohenjo-daro?', '["Indus Valley Civilization","Roman Empire","Inca Empire","Ancient Egypt"]', 'Indus Valley Civilization', 'Mohenjo-daro was a major city of the Indus Valley Civilization, in present-day Sindh, Pakistan.', 'easy'),
('In which year was Pakistan created through the Partition of British India?', '["1857","1914","1947","1971"]', '1947', 'British India was partitioned into India and Pakistan in August 1947.', 'easy'),
('Which Mughal emperor had the Lahore Fort rebuilt in brick around 1566?', '["Babur","Akbar","Shah Jahan","Aurangzeb"]', 'Akbar', 'Akbar began the brick reconstruction of the Lahore Fort in the 1560s.', 'medium'),
('Which monument was completed in Rome in 80 CE?', '["The Pantheon","The Colosseum","The Parthenon","Hagia Sophia"]', 'The Colosseum', 'The Colosseum was inaugurated under the emperor Titus in 80 CE.', 'easy'),
('The Eiffel Tower was built for which event?', '["The 1889 Exposition Universelle","The 1900 Olympics","Napoleon''s coronation","The Treaty of Versailles"]', 'The 1889 Exposition Universelle', 'It was the entrance arch to the 1889 World''s Fair in Paris.', 'medium'),
('Machu Picchu was built by which empire?', '["Aztec","Maya","Inca","Olmec"]', 'Inca', 'Machu Picchu was an Inca citadel in the Andes of Peru.', 'easy'),
('Which city was Japan''s imperial capital from 794 for over a thousand years?', '["Tokyo","Osaka","Nara","Kyoto"]', 'Kyoto', 'The capital moved to Heian-kyo, now Kyoto, in 794.', 'medium'),
('Where was the Lahore Resolution adopted in 1940?', '["Delhi","Karachi","Lahore","Dhaka"]', 'Lahore', 'It was adopted at the Muslim League session in Lahore on 23 March 1940.', 'medium');

-- Optional immersive scenes (full-screen image/video after time travel).
-- Put your own licensed files in public/media/ and add rows like these. With no matching row the site
-- shows the event/destination image if there is one, otherwise a generated animated scene.
-- INSERT INTO scenes (mode, year_from, year_to, title, media_type, media_url, poster_url, credit) VALUES
-- ('future', 2031, 2100, 'City of 2050', 'video', '/media/future-city.mp4', '/media/future-city.jpg', 'Your credit here'),
-- ('past', 1900, 1960, 'Lahore, mid-century', 'image', '/media/lahore-1947.jpg', NULL, 'Your credit here');

-- Globe coordinates (latitude, longitude) for the sample destinations.
UPDATE destinations d SET latitude = v.lat, longitude = v.lng FROM (VALUES
  ('Lahore', 31.5497, 74.3436), ('Mohenjo-daro', 27.3243, 68.1357), ('Giza', 29.9792, 31.1342),
  ('Rome', 41.9028, 12.4964), ('Kyoto', 35.0116, 135.7681), ('Machu Picchu', -13.1631, -72.5450),
  ('Paris', 48.8566, 2.3522)
) AS v(name, lat, lng) WHERE d.name = v.name;
-- Optional 3D model for /explore (a .glb in public/media/), e.g.:
-- INSERT INTO scenes (mode, year_from, year_to, title, media_type, media_url, model_url, credit) VALUES
-- ('past', 1500, 1800, 'Lahore Fort', 'image', '/media/lahore-fort.jpg', '/media/lahore-fort.glb', 'Model author / licence');
