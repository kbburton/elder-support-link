-- Remove the old location field and add structured address fields plus transportation information
ALTER TABLE appointments 
DROP COLUMN IF EXISTS location,
ADD COLUMN street_address text,
ADD COLUMN street_address_2 text,
ADD COLUMN city text,
ADD COLUMN state text,
ADD COLUMN zip_code text,
ADD COLUMN transportation_information text;