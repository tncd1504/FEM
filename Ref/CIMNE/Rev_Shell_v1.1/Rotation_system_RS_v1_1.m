function Te = Rotation_system_RS_v1_1(cxy)

%% Rotation_system_RS Evaluates the coordinate system for each element
%
%  Parameters:
%
%    Input, cxy : Contains the 2D coordinates of the nodes
%                 cxy(node)
%    
%    Output, Te the rotation matrix

%
%****  ELEMENT
%

  x = cxy(2,1) - cxy(1,1);
  y = cxy(2,2) - cxy(1,2);
  len = sqrt(x^2+y^2);
  
  co = x / len ;
  se = y / len ;
  
  Te = [  co, se, 0 ;
         -se, co, 0 ;
           0,  0, 1];

     
