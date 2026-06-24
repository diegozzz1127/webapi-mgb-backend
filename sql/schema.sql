-- =====================================================================
-- Esquema de base de datos para el sistema de denuncias (Azure SQL)
-- Ejecutar una vez sobre la base de datos creada en Azure SQL.
-- =====================================================================

-- Tabla de usuarios para el login (la crea esta aplicación)
IF OBJECT_ID('dbo.UsuariosWeb', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsuariosWeb (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        Usuario       NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash  NVARCHAR(255) NOT NULL,
        Activo        BIT NOT NULL DEFAULT 1,
        FechaCreacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- =====================================================================
-- NOTA: Las denuncias se almacenan en la tabla existente dbo.ACC_Denuncias
-- y los operarios se validan contra dbo.ACC_Personal / dbo.ACC_Areas.
-- Esas tablas YA EXISTEN en la base y NO se crean desde esta aplicación.
--
-- Estructura usada de dbo.ACC_Denuncias:
--   DE_TipoDocu (int), DE_NumeroDocu (decimal), DE_Area (int),
--   DE_FecDenu (datetime), DE_FecAcc (datetime),
--   DE_DiagIng1..4 (nvarchar(80)), DE_AbanTrab (bit),
--   DE_FecAbanTrab (datetime), DE_AceptaDenu (nvarchar(1))
-- =====================================================================
