-- Migrate existing file URLs to new format: filename_timestamp_groupId.ext
UPDATE documents 
SET file_url = CASE 
  WHEN file_url IS NOT NULL AND file_url LIKE '%_%_%' THEN
    -- Extract parts: filename_timestamp_0.ext -> filename_timestamp_groupId.ext
    CONCAT(
      -- Get filename part (everything before last two underscores)
      SUBSTRING(file_url FROM '^(.+)_[0-9]+_[0-9]+\.'),
      '_',
      -- Get timestamp part (second to last underscore to last underscore, remove _0)
      REGEXP_REPLACE(
        SUBSTRING(file_url FROM '_([0-9]+)_[0-9]+\.'), 
        '_[0-9]+$', 
        ''
      ),
      '_',
      -- Add group_id
      group_id::text,
      '.',
      -- Get file extension
      SUBSTRING(file_url FROM '\.([^.]+)$')
    )
  ELSE file_url
END
WHERE file_url IS NOT NULL AND file_url LIKE '%_%_%';