library(tidyverse)
library(lubridate)

setwd("C:/Users/eduar/repos/gringotts-v2/new")

f <- list.files(pattern = "*.xlsx")
f <- f[!(f == "spendee-to-spendid.xlsx")]

cat <- readxl::read_excel("spendee-to-spendid.xlsx")

last_row_id <- 5683 # this is the row id of the last rown in spending database 

d <- NULL
for(i in 1:length(f)){
 tmp <- readxl::read_excel(f[i])
 tmp$rowid <- last_row_id + i
 tmp$date_google <- format(as.Date(tmp$Date), "%m/%d/%Y")
 tmp$spend <- tmp$Amount*-1
 tmp$currency <- tmp$Currency
 tmp$category <- as.character(tmp$`Category name`)
 
 tmp <- tmp %>% 
   left_join(., cat)
 
 d <- rbind.data.frame(d, tmp)
 
}


## do in excel !
writexl::write_xlsx(d, path = "spendee2.xlsx")

