CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`name` text,
	`investment_id` text NOT NULL,
	`allocation_type` text,
	`category` text,
	`percentage` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allocations_notion_id_unique` ON `allocations` (`notion_id`);--> statement-breakpoint
CREATE INDEX `allocations_investment_idx` ON `allocations` (`investment_id`);--> statement-breakpoint
CREATE TABLE `budget` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`transaction` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`category_id` text NOT NULL,
	`charge_date` text NOT NULL,
	`mm` integer,
	`euro_money` real,
	`status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_notion_id_unique` ON `budget` (`notion_id`);--> statement-breakpoint
CREATE INDEX `budget_charge_date_idx` ON `budget` (`charge_date`);--> statement-breakpoint
CREATE INDEX `budget_category_idx` ON `budget` (`category_id`);--> statement-breakpoint
CREATE INDEX `budget_mm_idx` ON `budget` (`mm`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`name` text NOT NULL,
	`spend_name` text,
	`spend_id` text,
	`spend_grp` text,
	`spend_lifegrp` text,
	`status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_notion_id_unique` ON `categories` (`notion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_spend_id_unique` ON `categories` (`spend_id`);--> statement-breakpoint
CREATE INDEX `categories_spend_id_idx` ON `categories` (`spend_id`);--> statement-breakpoint
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`name` text NOT NULL,
	`ticker` text,
	`quantity` real,
	`purchase_price` real,
	`purchase_date` text,
	`current_price` real,
	`currency` text,
	`asset_type` text,
	`vest_date` text,
	`last_price_update` text,
	`notes` text,
	`annual_growth_rate` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investments_notion_id_unique` ON `investments` (`notion_id`);--> statement-breakpoint
CREATE INDEX `investments_ticker_idx` ON `investments` (`ticker`);--> statement-breakpoint
CREATE TABLE `merchant_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`spend_id` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`spend_id`) REFERENCES `categories`(`spend_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `merchant_rules_pattern_idx` ON `merchant_rules` (`pattern`);--> statement-breakpoint
CREATE TABLE `spendee_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`spendee_category` text NOT NULL,
	`spend_id` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`spend_id`) REFERENCES `categories`(`spend_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `spendee_rules_category_idx` ON `spendee_rules` (`spendee_category`);--> statement-breakpoint
CREATE TABLE `spending` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`transaction` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`category_id` text NOT NULL,
	`charge_date` text NOT NULL,
	`money_date` text,
	`method` text,
	`mm` integer,
	`euro_money` real,
	`spend_name` text,
	`status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spending_notion_id_unique` ON `spending` (`notion_id`);--> statement-breakpoint
CREATE INDEX `spending_charge_date_idx` ON `spending` (`charge_date`);--> statement-breakpoint
CREATE INDEX `spending_category_idx` ON `spending` (`category_id`);--> statement-breakpoint
CREATE INDEX `spending_mm_idx` ON `spending` (`mm`);