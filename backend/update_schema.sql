-- SQL script to make the embedding field nullable in the students table

-- Make sure you're using the right database
USE `face-logbook`;

-- Display current column definition before change
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE 
FROM information_schema.columns 
WHERE table_schema = 'face-logbook' 
AND table_name = 'students' 
AND column_name = 'embedding';

-- Alter the table to make embedding nullable
ALTER TABLE students MODIFY embedding LONGBLOB NULL;

-- Verify the change after modification
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE 
FROM information_schema.columns 
WHERE table_schema = 'face-logbook' 
AND table_name = 'students' 
AND column_name = 'embedding';