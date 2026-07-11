import type { FeatureProfile } from './featureTypes'
import type { BaseSpinResult, GameConfig, SymbolId } from './types'

export function getFeatureProfiles(config: Pick<GameConfig, 'featureProfiles'>): FeatureProfile[] {
  if (config.featureProfiles.length === 0) {
    throw new Error('GameConfig requires at least one feature profile.')
  }
  return config.featureProfiles
}

export function getPrimaryFeatureProfile(config: Pick<GameConfig, 'featureProfiles'>): FeatureProfile {
  return getFeatureProfiles(config)[0]
}

export function getFeatureProfile(
  config: Pick<GameConfig, 'featureProfiles'>,
  id: string | null | undefined,
): FeatureProfile | undefined {
  return id ? config.featureProfiles.find((profile) => profile.id === id) : undefined
}

export function getFeatureTriggerSymbol(profile: FeatureProfile): SymbolId {
  return (profile.triggerSymbol ?? 'footprint') as SymbolId
}

export function getTriggeredFeatureProfile(
  config: Pick<GameConfig, 'featureProfiles'>,
  spin: Pick<BaseSpinResult, 'triggeredFeatureId'>,
): FeatureProfile {
  return getFeatureProfile(config, spin.triggeredFeatureId) ?? getPrimaryFeatureProfile(config)
}

export function withUpdatedFeatureProfile(
  config: GameConfig,
  updatedProfile: FeatureProfile,
): GameConfig {
  const hasMatchingProfile = config.featureProfiles.some(
    (profile) => profile.id === updatedProfile.id,
  )
  return {
    ...config,
    featureProfiles: hasMatchingProfile
      ? config.featureProfiles.map((profile) =>
          profile.id === updatedProfile.id ? updatedProfile : profile,
        )
      : [updatedProfile, ...config.featureProfiles.slice(1)],
  }
}
