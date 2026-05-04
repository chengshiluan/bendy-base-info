import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  actionPermissionCode,
  getPermissionSeed,
  menuPermissionCode,
  permissionSeeds,
  systemRoleKeys,
  systemRoleSeeds,
  type SystemRoleKey
} from '@/lib/platform/rbac';

interface BootstrapResult {
  insertedPermissions: number;
  insertedRoles: number;
  patchedRoles: number;
  insertedRolePermissions: number;
  insertedWorkspaceMemberRoles: number;
  migratedLegacyRolePermissions: number;
  deletedLegacyPermissions: number;
}

let initializationPromise: Promise<void> | null = null;

const legacyPermissionReplacementCodeMap = {
  'dashboard.view': [menuPermissionCode('dashboard', 'overview')],
  'files.upload': [
    actionPermissionCode('upload', 'dashboard', 'workspaces', 'tickets')
  ],
  'kanban.manage': [
    actionPermissionCode('update', 'dashboard', 'workspaces', 'kanban')
  ],
  'kanban.view': [menuPermissionCode('dashboard', 'workspaces', 'kanban')],
  'notifications.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'notifications'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'notifications'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'notifications'),
    actionPermissionCode('read', 'dashboard', 'workspaces', 'notifications')
  ],
  'notifications.publish': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'notifications')
  ],
  'notifications.view': [
    menuPermissionCode('dashboard', 'workspaces', 'notifications')
  ],
  'permissions.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'permissions'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'permissions'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'permissions')
  ],
  'permissions.view': [
    menuPermissionCode('dashboard', 'workspaces', 'permissions')
  ],
  'profile.update': [actionPermissionCode('update', 'dashboard', 'profile')],
  'profile.view': [menuPermissionCode('dashboard', 'profile')],
  'roles.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'roles'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'roles'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'roles')
  ],
  'roles.view': [menuPermissionCode('dashboard', 'workspaces', 'roles')],
  'teams.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'teams'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'teams'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'teams'),
    actionPermissionCode('import', 'dashboard', 'workspaces', 'teams')
  ],
  'teams.view': [menuPermissionCode('dashboard', 'workspaces', 'teams')],
  'tickets.assign': [
    actionPermissionCode('assign', 'dashboard', 'workspaces', 'tickets')
  ],
  'tickets.comment': [
    actionPermissionCode('comment', 'dashboard', 'workspaces', 'tickets')
  ],
  'tickets.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'tickets'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'tickets'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'tickets'),
    actionPermissionCode('assign', 'dashboard', 'workspaces', 'tickets'),
    actionPermissionCode('comment', 'dashboard', 'workspaces', 'tickets'),
    actionPermissionCode('upload', 'dashboard', 'workspaces', 'tickets')
  ],
  'tickets.view': [menuPermissionCode('dashboard', 'workspaces', 'tickets')],
  'users.import': [
    actionPermissionCode('import', 'dashboard', 'workspaces', 'teams')
  ],
  'users.manage': [
    actionPermissionCode('create', 'dashboard', 'workspaces', 'users'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'users'),
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'users')
  ],
  'users.view': [menuPermissionCode('dashboard', 'workspaces', 'users')],
  'workspaces.manage': [
    menuPermissionCode('dashboard', 'workspaces'),
    menuPermissionCode('dashboard', 'workspaces', 'manage'),
    actionPermissionCode('create', 'dashboard', 'workspaces', 'manage'),
    actionPermissionCode('update', 'dashboard', 'workspaces', 'manage'),
    actionPermissionCode('archive', 'dashboard', 'workspaces', 'manage')
  ],
  'workspaces.view': [
    menuPermissionCode('dashboard', 'workspaces'),
    menuPermissionCode('dashboard', 'workspaces', 'manage')
  ]
} as const satisfies Record<string, string[]>;

const legacyPermissionCodesToDelete = [
  'audit_logs.view',
  'files.view',
  'workspaces.switch',
  ...Object.keys(legacyPermissionReplacementCodeMap)
];

function expandReplacementCodes(codes: string[]) {
  const expanded = new Set<string>();

  codes.forEach((code) => {
    let currentCode: string | null | undefined = code;

    while (currentCode) {
      const seed = getPermissionSeed(currentCode);
      if (!seed || expanded.has(currentCode)) {
        break;
      }

      expanded.add(currentCode);
      currentCode = seed.parentCode;
    }
  });

  return Array.from(expanded);
}

// Schema initialization is handled by drizzle-kit (run `npm run db:push`).
// Legacy GitHub-id migration is a no-op on fresh SQLite databases.
export async function ensureGithubBackedUserIds() {
  return;
}

async function ensurePermissionSeeds() {
  if (!db) {
    return {
      insertedPermissions: 0,
      permissionIdByCode: new Map<string, string>()
    };
  }

  const seededCodes = permissionSeeds.map((permission) => permission.code);
  const seededCodeSet = new Set(seededCodes);
  const existingPermissions = seededCodes.length
    ? await db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code,
          name: schema.permissions.name,
          module: schema.permissions.module,
          action: schema.permissions.action,
          scope: schema.permissions.scope,
          permissionType: schema.permissions.permissionType,
          parentCode: schema.permissions.parentCode,
          route: schema.permissions.route,
          sortOrder: schema.permissions.sortOrder,
          isSystem: schema.permissions.isSystem,
          description: schema.permissions.description
        })
        .from(schema.permissions)
        .where(inArray(schema.permissions.code, seededCodes))
    : [];
  const existingSystemPermissions = await db
    .select({
      id: schema.permissions.id,
      code: schema.permissions.code
    })
    .from(schema.permissions)
    .where(eq(schema.permissions.isSystem, true));

  const existingCodeSet = new Set(
    existingPermissions.map((permission) => permission.code)
  );
  const missingPermissions = permissionSeeds.filter(
    (permission) => !existingCodeSet.has(permission.code)
  );

  if (missingPermissions.length) {
    await db
      .insert(schema.permissions)
      .values(
        missingPermissions.map((permission) => ({
          code: permission.code,
          name: permission.name,
          module: permission.module,
          action: permission.action,
          scope: permission.scope,
          permissionType: permission.permissionType,
          parentCode: permission.parentCode,
          route: permission.route,
          sortOrder: permission.sortOrder,
          isSystem: permission.isSystem,
          description: permission.description
        }))
      )
      .onConflictDoNothing({ target: schema.permissions.code });
  }

  const existingPermissionMap = new Map(
    existingPermissions.map(
      (permission) => [permission.code, permission] as const
    )
  );

  for (const permission of permissionSeeds) {
    const existingPermission = existingPermissionMap.get(permission.code);

    if (!existingPermission) {
      continue;
    }

    const needsPatch =
      existingPermission.name !== permission.name ||
      existingPermission.module !== permission.module ||
      existingPermission.action !== permission.action ||
      existingPermission.scope !== permission.scope ||
      existingPermission.permissionType !== permission.permissionType ||
      (existingPermission.parentCode ?? null) !== permission.parentCode ||
      (existingPermission.route ?? null) !== permission.route ||
      existingPermission.sortOrder !== permission.sortOrder ||
      existingPermission.isSystem !== permission.isSystem ||
      (existingPermission.description ?? null) !== permission.description;

    if (!needsPatch) {
      continue;
    }

    await db
      .update(schema.permissions)
      .set({
        name: permission.name,
        module: permission.module,
        action: permission.action,
        scope: permission.scope,
        permissionType: permission.permissionType,
        parentCode: permission.parentCode,
        route: permission.route,
        sortOrder: permission.sortOrder,
        isSystem: permission.isSystem,
        description: permission.description,
        updatedAt: new Date()
      })
      .where(eq(schema.permissions.code, permission.code));
  }

  const obsoleteSystemPermissionIds = existingSystemPermissions
    .filter((permission) => !seededCodeSet.has(permission.code))
    .map((permission) => permission.id);

  if (obsoleteSystemPermissionIds.length) {
    await db
      .delete(schema.permissions)
      .where(inArray(schema.permissions.id, obsoleteSystemPermissionIds));
  }

  const allPermissions = seededCodes.length
    ? await db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code
        })
        .from(schema.permissions)
        .where(inArray(schema.permissions.code, seededCodes))
    : [];

  return {
    insertedPermissions: missingPermissions.length,
    permissionIdByCode: new Map(
      allPermissions.map((permission) => [permission.code, permission.id])
    )
  };
}

async function ensureLegacyPermissionCleanup(
  permissionIdByCode: Map<string, string>
) {
  if (!db || !legacyPermissionCodesToDelete.length) {
    return {
      migratedLegacyRolePermissions: 0,
      deletedLegacyPermissions: 0
    };
  }

  const legacyPermissions = await db
    .select({
      id: schema.permissions.id,
      code: schema.permissions.code
    })
    .from(schema.permissions)
    .where(inArray(schema.permissions.code, legacyPermissionCodesToDelete));

  if (!legacyPermissions.length) {
    return {
      migratedLegacyRolePermissions: 0,
      deletedLegacyPermissions: 0
    };
  }

  const legacyCodeByPermissionId = new Map(
    legacyPermissions.map(
      (permission) => [permission.id, permission.code] as const
    )
  );
  const legacyPermissionIds = legacyPermissions.map(
    (permission) => permission.id
  );
  const existingMappings = await db
    .select({
      roleId: schema.rolePermissions.roleId,
      permissionId: schema.rolePermissions.permissionId
    })
    .from(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.permissionId, legacyPermissionIds));

  const replacementIdsByLegacyCode = new Map<string, string[]>(
    Object.entries(legacyPermissionReplacementCodeMap).map(
      ([legacyCode, replacementCodes]) => [
        legacyCode,
        expandReplacementCodes([...replacementCodes])
          .map((code) => permissionIdByCode.get(code))
          .filter((permissionId): permissionId is string =>
            Boolean(permissionId)
          )
      ]
    )
  );

  const mappingRowsToInsert = existingMappings.flatMap((mapping) => {
    const legacyCode = legacyCodeByPermissionId.get(mapping.permissionId);
    if (!legacyCode) {
      return [];
    }

    return (replacementIdsByLegacyCode.get(legacyCode) ?? []).map(
      (permissionId) => ({
        roleId: mapping.roleId,
        permissionId
      })
    );
  });

  if (mappingRowsToInsert.length) {
    await db
      .insert(schema.rolePermissions)
      .values(mappingRowsToInsert)
      .onConflictDoNothing({
        target: [
          schema.rolePermissions.roleId,
          schema.rolePermissions.permissionId
        ]
      });
  }

  await db
    .delete(schema.permissions)
    .where(inArray(schema.permissions.id, legacyPermissionIds));

  return {
    migratedLegacyRolePermissions: mappingRowsToInsert.length,
    deletedLegacyPermissions: legacyPermissionIds.length
  };
}

async function resolveTargetWorkspaceIds(workspaceIds?: string[]) {
  if (!db) {
    return [];
  }

  const normalizedWorkspaceIds = Array.from(
    new Set((workspaceIds ?? []).filter(Boolean))
  );

  if (normalizedWorkspaceIds.length) {
    return normalizedWorkspaceIds;
  }

  const workspaces = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces);

  return workspaces.map((workspace) => workspace.id);
}

async function ensureSystemRoles(workspaceIds?: string[]) {
  const empty = {
    insertedRoles: 0,
    patchedRoles: 0,
    roles: [] as { id: string; workspaceId: string; key: string }[]
  };

  if (!db) {
    return empty;
  }

  const targetWorkspaceIds = await resolveTargetWorkspaceIds(workspaceIds);

  if (!targetWorkspaceIds.length) {
    return empty;
  }

  const existingRoles = await db
    .select({
      id: schema.roles.id,
      workspaceId: schema.roles.workspaceId,
      key: schema.roles.key,
      name: schema.roles.name,
      description: schema.roles.description,
      isSystem: schema.roles.isSystem
    })
    .from(schema.roles)
    .where(inArray(schema.roles.workspaceId, targetWorkspaceIds));

  const roleSeedByKey = new Map(
    systemRoleSeeds.map((role) => [role.key, role] as const)
  );
  const existingRoleMap = new Map(
    existingRoles
      .filter((role) => roleSeedByKey.has(role.key as SystemRoleKey))
      .map((role) => [`${role.workspaceId}:${role.key}`, role])
  );

  const rolesToInsert = targetWorkspaceIds.flatMap((workspaceId) =>
    systemRoleSeeds
      .filter((role) => !existingRoleMap.has(`${workspaceId}:${role.key}`))
      .map((role) => ({
        workspaceId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true
      }))
  );

  if (rolesToInsert.length) {
    await db
      .insert(schema.roles)
      .values(rolesToInsert)
      .onConflictDoNothing({
        target: [schema.roles.workspaceId, schema.roles.key]
      });
  }

  let patchedRoles = 0;

  for (const role of existingRoles) {
    const seed = roleSeedByKey.get(role.key as SystemRoleKey);

    if (!seed || !targetWorkspaceIds.includes(role.workspaceId)) {
      continue;
    }

    const updates: {
      name?: string;
      description?: string;
      isSystem?: boolean;
      updatedAt?: Date;
    } = {};

    if (!role.isSystem) {
      updates.isSystem = true;
    }

    if (!role.name.trim()) {
      updates.name = seed.name;
    }

    if (!role.description?.trim()) {
      updates.description = seed.description;
    }

    if (Object.keys(updates).length) {
      updates.updatedAt = new Date();

      await db
        .update(schema.roles)
        .set(updates)
        .where(eq(schema.roles.id, role.id));

      patchedRoles += 1;
    }
  }

  const roles = await db
    .select({
      id: schema.roles.id,
      workspaceId: schema.roles.workspaceId,
      key: schema.roles.key
    })
    .from(schema.roles)
    .where(inArray(schema.roles.workspaceId, targetWorkspaceIds));

  return {
    insertedRoles: rolesToInsert.length,
    patchedRoles,
    roles: roles.filter((role) =>
      systemRoleKeys.includes(role.key as SystemRoleKey)
    )
  };
}

async function ensureSystemRolePermissions(
  roles: { id: string; workspaceId: string; key: string }[],
  permissionIdByCode: Map<string, string>
) {
  if (!db || !roles.length) {
    return 0;
  }

  const roleIds = roles.map((role) => role.id);
  const existingMappings = await db
    .select({
      roleId: schema.rolePermissions.roleId,
      permissionId: schema.rolePermissions.permissionId
    })
    .from(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.roleId, roleIds));

  const existingMappingSet = new Set(
    existingMappings.map(
      (mapping) => `${mapping.roleId}:${mapping.permissionId}`
    )
  );
  const existingPermissionIdsByRoleId = new Map<string, string[]>();
  existingMappings.forEach((mapping) => {
    const current = existingPermissionIdsByRoleId.get(mapping.roleId) ?? [];
    current.push(mapping.permissionId);
    existingPermissionIdsByRoleId.set(mapping.roleId, current);
  });

  const desiredPermissionIdsByRoleId = new Map<string, string[]>();
  const rolePermissionRows = roles.flatMap((role) => {
    const seed = systemRoleSeeds.find(
      (candidate) => candidate.key === role.key
    );

    if (!seed) {
      return [];
    }

    const desiredPermissionIds = seed.permissionCodes
      .map((code) => permissionIdByCode.get(code))
      .filter((permissionId): permissionId is string => Boolean(permissionId));
    desiredPermissionIdsByRoleId.set(role.id, desiredPermissionIds);

    return desiredPermissionIds
      .filter(
        (permissionId) => !existingMappingSet.has(`${role.id}:${permissionId}`)
      )
      .map((permissionId) => ({
        roleId: role.id,
        permissionId
      }));
  });

  for (const role of roles) {
    const desiredPermissionIds =
      desiredPermissionIdsByRoleId.get(role.id) ?? [];
    const desiredPermissionIdSet = new Set(desiredPermissionIds);
    const stalePermissionIds = (
      existingPermissionIdsByRoleId.get(role.id) ?? []
    ).filter((permissionId) => !desiredPermissionIdSet.has(permissionId));

    if (!stalePermissionIds.length) {
      continue;
    }

    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.roleId, role.id),
          inArray(schema.rolePermissions.permissionId, stalePermissionIds)
        )
      );
  }

  if (!rolePermissionRows.length) {
    return 0;
  }

  await db
    .insert(schema.rolePermissions)
    .values(rolePermissionRows)
    .onConflictDoNothing({
      target: [
        schema.rolePermissions.roleId,
        schema.rolePermissions.permissionId
      ]
    });
  return rolePermissionRows.length;
}

async function ensureWorkspaceMemberRoleAssignments(
  roles: { id: string; workspaceId: string; key: string }[]
) {
  if (!db || !roles.length) {
    return 0;
  }

  const targetWorkspaceIds = Array.from(
    new Set(roles.map((role) => role.workspaceId))
  );
  const roleIdByWorkspaceAndKey = new Map(
    roles.map((role) => [`${role.workspaceId}:${role.key}`, role.id] as const)
  );
  const workspaceMemberships = await db
    .select({
      workspaceId: schema.workspaceMembers.workspaceId,
      userId: schema.workspaceMembers.userId,
      systemRole: schema.users.systemRole
    })
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.users,
      eq(schema.workspaceMembers.userId, schema.users.id)
    )
    .where(inArray(schema.workspaceMembers.workspaceId, targetWorkspaceIds));

  const existingAssignments = await db
    .select({
      workspaceId: schema.workspaceMemberRoles.workspaceId,
      userId: schema.workspaceMemberRoles.userId
    })
    .from(schema.workspaceMemberRoles)
    .where(
      inArray(schema.workspaceMemberRoles.workspaceId, targetWorkspaceIds)
    );

  const existingAssignmentSet = new Set(
    existingAssignments.map(
      (assignment) => `${assignment.workspaceId}:${assignment.userId}`
    )
  );
  const roleAssignmentsToInsert = workspaceMemberships
    .filter(
      (membership) =>
        !existingAssignmentSet.has(
          `${membership.workspaceId}:${membership.userId}`
        )
    )
    .map((membership) => {
      const roleId = roleIdByWorkspaceAndKey.get(
        `${membership.workspaceId}:${membership.systemRole}`
      );

      if (!roleId) {
        return null;
      }

      return {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        roleId
      };
    })
    .filter(
      (
        assignment
      ): assignment is {
        workspaceId: string;
        userId: string;
        roleId: string;
      } => Boolean(assignment)
    );

  if (!roleAssignmentsToInsert.length) {
    return 0;
  }

  await db
    .insert(schema.workspaceMemberRoles)
    .values(roleAssignmentsToInsert)
    .onConflictDoNothing({
      target: [
        schema.workspaceMemberRoles.workspaceId,
        schema.workspaceMemberRoles.userId,
        schema.workspaceMemberRoles.roleId
      ]
    });

  return roleAssignmentsToInsert.length;
}

export async function ensureWorkspaceRbacInitialized(workspaceIds?: string[]) {
  if (!db) {
    return {
      insertedPermissions: 0,
      insertedRoles: 0,
      patchedRoles: 0,
      insertedRolePermissions: 0,
      insertedWorkspaceMemberRoles: 0,
      migratedLegacyRolePermissions: 0,
      deletedLegacyPermissions: 0
    } satisfies BootstrapResult;
  }

  const { insertedPermissions, permissionIdByCode } =
    await ensurePermissionSeeds();
  const { migratedLegacyRolePermissions, deletedLegacyPermissions } =
    await ensureLegacyPermissionCleanup(permissionIdByCode);
  const { insertedRoles, patchedRoles, roles } =
    await ensureSystemRoles(workspaceIds);
  const insertedRolePermissions = await ensureSystemRolePermissions(
    roles,
    permissionIdByCode
  );
  const insertedWorkspaceMemberRoles =
    await ensureWorkspaceMemberRoleAssignments(roles);

  return {
    insertedPermissions,
    insertedRoles,
    patchedRoles,
    insertedRolePermissions,
    insertedWorkspaceMemberRoles,
    migratedLegacyRolePermissions,
    deletedLegacyPermissions
  } satisfies BootstrapResult;
}

export async function ensureDatabaseInitialized() {
  if (!db) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      const result = await ensureWorkspaceRbacInitialized();

      if (
        result.insertedPermissions ||
        result.insertedRoles ||
        result.patchedRoles ||
        result.insertedRolePermissions ||
        result.insertedWorkspaceMemberRoles ||
        result.migratedLegacyRolePermissions ||
        result.deletedLegacyPermissions
      ) {
        console.info('[db:init] database bootstrap completed', result);
      }
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}
