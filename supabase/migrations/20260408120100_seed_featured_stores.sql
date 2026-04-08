-- Flag all currently live stores as featured (At Home Apothecary is the only one)
update stores set is_featured = true where status = 'live';
