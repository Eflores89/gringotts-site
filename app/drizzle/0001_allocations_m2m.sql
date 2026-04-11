CREATE TABLE `allocation_investments` (
	`allocation_id` text NOT NULL,
	`investment_id` text NOT NULL,
	PRIMARY KEY(`allocation_id`, `investment_id`),
	FOREIGN KEY (`allocation_id`) REFERENCES `allocations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alloc_inv_allocation_idx` ON `allocation_investments` (`allocation_id`);--> statement-breakpoint
CREATE INDEX `alloc_inv_investment_idx` ON `allocation_investments` (`investment_id`);--> statement-breakpoint
DROP INDEX `allocations_investment_idx`;--> statement-breakpoint
ALTER TABLE `allocations` DROP COLUMN `investment_id`;