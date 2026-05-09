ALTER TABLE `categories` ADD `kind` text DEFAULT 'spend' NOT NULL;--> statement-breakpoint
CREATE INDEX `categories_kind_idx` ON `categories` (`kind`);--> statement-breakpoint
ALTER TABLE `income` ADD `kind` text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE `income` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
CREATE INDEX `income_kind_idx` ON `income` (`kind`);--> statement-breakpoint
CREATE INDEX `income_category_idx` ON `income` (`category_id`);