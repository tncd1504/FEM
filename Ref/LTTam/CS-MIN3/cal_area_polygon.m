%--------------------------------------------------------
%purpose:
%compute the area of each element
%
%Synopsis:
%[area]=cal_area(x,y)
%
%variable description:
%area - the area of each element
%x - x coord value of element
%y - y coord value of element
%--------------------------------------------------------

function [area]=cal_area_polygon(x,y)

nsel=length(x);     %nsel n: number   s:side   el:element

if nsel==3    
    
    area=0.5*(x(1)*y(2)+x(2)*y(3)+x(3)*y(1)-...
        x(1)*y(3)-x(2)*y(1)-x(3)*y(2));               %area of triangula 

elseif nsel==4
    
    area1=0.5*(x(1)*y(2)+x(2)*y(3)+x(3)*y(1)-...
        x(1)*y(3)-x(2)*y(1)-x(3)*y(2));               %area of 1st triangula 
    
    area2=0.5*(x(1)*y(3)+x(3)*y(4)+x(4)*y(1)-...
        x(1)*y(4)-x(3)*y(1)-x(4)*y(3));               %area of 2rd triangula 
    
    area=area1+area2;
    
elseif nsel==5
    
    area1=0.5*(x(1)*y(2)+x(2)*y(3)+x(3)*y(1)-...
        x(1)*y(3)-x(2)*y(1)-x(3)*y(2));               %area of 1st triangula 
    
    area2=0.5*(x(1)*y(3)+x(3)*y(4)+x(4)*y(1)-...
        x(1)*y(4)-x(3)*y(1)-x(4)*y(3));               %area of 2rd triangula 
    
    area3=0.5*(x(1)*y(4)+x(4)*y(5)+x(5)*y(1)-...
        x(1)*y(5)-x(4)*y(1)-x(5)*y(4));               %area of 3nd triangula 
    
    area=area1+area2+area3;
    
elseif nsel==6
    
    area1=0.5*(x(1)*y(2)+x(2)*y(3)+x(3)*y(1)-...
        x(1)*y(3)-x(2)*y(1)-x(3)*y(2));               %area of 1st triangula 
    
    area2=0.5*(x(1)*y(3)+x(3)*y(4)+x(4)*y(1)-...
        x(1)*y(4)-x(3)*y(1)-x(4)*y(3));               %area of 2rd triangula 
    
    area3=0.5*(x(1)*y(4)+x(4)*y(5)+x(5)*y(1)-...
        x(1)*y(5)-x(4)*y(1)-x(5)*y(4));               %area of 3nd triangula 
    
    area4=0.5*(x(1)*y(5)+x(5)*y(6)+x(6)*y(1)-...
        x(1)*y(6)-x(5)*y(1)-x(6)*y(5));               %area of 4th triangula 
    
    area=area1+area2+area3+area4;
    
end

area=abs(area); 
        
        