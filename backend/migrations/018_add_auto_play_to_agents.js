/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  return knex.schema.alterTable('agents', function(table) {
    table.boolean('auto_play').defaultTo(false).after('config');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  return knex.schema.alterTable('agents', function(table) {
    table.dropColumn('auto_play');
  });
}
