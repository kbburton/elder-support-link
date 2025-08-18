-- Check if OpenAI processing is set up by running a query to see existing document processing
SELECT processing_status, COUNT(*) FROM documents GROUP BY processing_status;