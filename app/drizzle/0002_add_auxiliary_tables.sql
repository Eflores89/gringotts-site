CREATE TABLE `income` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`charge_date` text NOT NULL,
	`mm` integer,
	`euro_money` real,
	`source` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `income_charge_date_idx` ON `income` (`charge_date`);--> statement-breakpoint
CREATE INDEX `income_mm_idx` ON `income` (`mm`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_name_unique` ON `payment_methods` (`name`);--> statement-breakpoint
CREATE TABLE `spending_reimbursements` (
	`id` text PRIMARY KEY NOT NULL,
	`spending_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`euro_money` real,
	`description` text,
	`reimbursed_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`spending_id`) REFERENCES `spending`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reimb_spending_idx` ON `spending_reimbursements` (`spending_id`);