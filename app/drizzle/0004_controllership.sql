CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`investment_id` text,
	`jurisdiction_id` text,
	`entity_type` text,
	`functional_currency` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`jurisdiction_id`) REFERENCES `jurisdictions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_code_unique` ON `companies` (`code`);--> statement-breakpoint
CREATE INDEX `companies_jurisdiction_idx` ON `companies` (`jurisdiction_id`);--> statement-breakpoint
CREATE TABLE `jurisdictions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`corporate_tax_rate` real,
	`participation_exemption_threshold` real,
	`personal_dividend_rate` real,
	`personal_capital_gains_rate` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jurisdictions_code_unique` ON `jurisdictions` (`code`);--> statement-breakpoint
CREATE TABLE `ownership` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_company_id` text,
	`owned_company_id` text NOT NULL,
	`percentage` real NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`withholding_override` real,
	`intercompany_exempt` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owned_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ownership_owned_idx` ON `ownership` (`owned_company_id`);--> statement-breakpoint
CREATE INDEX `ownership_owner_idx` ON `ownership` (`owner_company_id`);--> statement-breakpoint
CREATE INDEX `ownership_effective_idx` ON `ownership` (`effective_from`,`effective_to`);