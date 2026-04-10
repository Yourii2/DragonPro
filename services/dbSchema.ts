// Export canonical SQL schema by importing the raw SQL dump.
// This file is used by the frontend setup to send the SQL to the server.
import schema from '../current_schema_struct.sql?raw';

export const SQL_SCHEMA = schema;
