import type { GlobalHoliday, Holiday, ProjectConfig } from '@/domain/models'

/**
 * Combine global holidays with project-specific holidays
 * Respects project configuration for which global holidays to use
 */
export function getCombinedHolidays(
  globalHolidays: GlobalHoliday[],
  projectConfig: ProjectConfig
): Holiday[] {
  const result: Holiday[] = []

  // Add global holidays if enabled
  if (projectConfig.useGlobalHolidays) {
    const includedGlobalHolidays = globalHolidays
      .filter(gh => !projectConfig.excludedGlobalHolidayIds.includes(gh.id))
      .map(gh => ({
        id: gh.id,
        date: gh.date,
        name: gh.name,
        description: gh.description,
        appliesTo: gh.appliesTo,
      }))

    result.push(...includedGlobalHolidays)
  }

  // Add project-specific holidays
  if (projectConfig.projectSpecificHolidays) {
    result.push(...projectConfig.projectSpecificHolidays)
  }

  return result
}

/**
 * Convert a GlobalHoliday to a Holiday for use in calculations
 */
export function globalHolidayToHoliday(globalHoliday: GlobalHoliday): Holiday {
  return {
    id: globalHoliday.id,
    date: globalHoliday.date,
    name: globalHoliday.name,
    description: globalHoliday.description,
    appliesTo: globalHoliday.appliesTo,
  }
}
