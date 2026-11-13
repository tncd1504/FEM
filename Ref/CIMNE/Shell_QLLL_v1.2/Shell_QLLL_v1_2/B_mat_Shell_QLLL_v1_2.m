function [bmat_b,bmat_m,bmat_s,area] = B_mat_Shell_QLLL_v1_2(xgs,ygs,x,y,Te)

%% B_Mat Computes the strain-displacement matrix for bending moments,
%        membrane forces and shear forces
%
%  Parameters:
%
%    Input, xgs : Local X coordinate of the Gauss point
%           ygs : Local Y coordinate of the Gauss point
%           x   : X Coordinates of the element
%           y   : Y Coordinates of the element
%           Te  : Rotation matrix
%   
%    Output, bmat_b the strain-displacement matrix for bending moments
%            bmat_m the strain-displacement matrix for membrane forces
%            bmat_s the strain-displacement matrix for shear forces
%              area the element area

%==================
  
  dxNl(1) = (-1+ygs)/4;
  dxNl(2) = ( 1-ygs)/4;
  dxNl(3) = ( 1+ygs)/4;
  dxNl(4) = (-1-ygs)/4;

  dyNl(1) = (-1+xgs)/4;
  dyNl(2) = (-1-xgs)/4;
  dyNl(3) = ( 1+xgs)/4;
  dyNl(4) = ( 1-xgs)/4;

  xjacm(1,1) = x(1)*dxNl(1) + x(2)*dxNl(2) + x(3)*dxNl(3) + x(4)*dxNl(4);
  xjacm(1,2) = y(1)*dxNl(1) + y(2)*dxNl(2) + y(3)*dxNl(3) + y(4)*dxNl(4);
  xjacm(2,1) = x(1)*dyNl(1) + x(2)*dyNl(2) + x(3)*dyNl(3) + x(4)*dyNl(4);
  xjacm(2,2) = y(1)*dyNl(1) + y(2)*dyNl(2) + y(3)*dyNl(3) + y(4)*dyNl(4);
  
  xjaci = inv(xjacm);
      
  area = abs(xjacm(1,1)*xjacm(2,2) - xjacm(2,1)*xjacm(1,2));
  
  dxN(1) = xjaci(1,1)*dxNl(1)+xjaci(1,2)*dyNl(1);
  dxN(2) = xjaci(1,1)*dxNl(2)+xjaci(1,2)*dyNl(2);
  dxN(3) = xjaci(1,1)*dxNl(3)+xjaci(1,2)*dyNl(3);
  dxN(4) = xjaci(1,1)*dxNl(4)+xjaci(1,2)*dyNl(4);
 
  dyN(1) = xjaci(2,1)*dxNl(1)+xjaci(2,2)*dyNl(1);
  dyN(2) = xjaci(2,1)*dxNl(2)+xjaci(2,2)*dyNl(2);
  dyN(3) = xjaci(2,1)*dxNl(3)+xjaci(2,2)*dyNl(3);
  dyN(4) = xjaci(2,1)*dxNl(4)+xjaci(2,2)*dyNl(4);

%==================

      bmat_b1  = [ 0, 0, 0,-dxN(1),     0  ;
                   0, 0, 0,      0,-dyN(1) ;
                   0, 0, 0,-dyN(1),-dxN(1)];
               
      bmat_b2  = [ 0, 0, 0,-dxN(2),     0  ;
                   0, 0, 0,      0,-dyN(2) ;
                   0, 0, 0,-dyN(2),-dxN(2)];
               
      bmat_b3  = [ 0, 0, 0,-dxN(3),     0  ;
                   0, 0, 0,      0,-dyN(3) ;
                   0, 0, 0,-dyN(3),-dxN(3)];
               
      bmat_b4  = [ 0, 0, 0,-dxN(4),     0  ;
                   0, 0, 0,      0,-dyN(4) ;
                   0, 0, 0,-dyN(4),-dxN(4)];

 
      bmat_b = [bmat_b1,bmat_b2,bmat_b3,bmat_b4];
      
%==================

      bmat_m1d  = [ dxN(1),     0,  0 ;
                         0, dyN(1), 0 ;
                    dyN(1), dxN(1), 0];
               
      bmat_m2d  = [ dxN(2),      0, 0 ;
                         0, dyN(2), 0 ;
                    dyN(2), dxN(2), 0];
               
      bmat_m3d  = [ dxN(3),      0, 0 ;
                         0, dyN(3), 0 ;
                    dyN(3), dxN(3), 0];
               
      bmat_m4d  = [ dxN(4),      0, 0 ;
                         0, dyN(4), 0 ;
                    dyN(4), dxN(4), 0];

      bmat_mir  = [ 0, 0 ;
                    0, 0 ;
                    0, 0];
                 
      bmat_m1 = [bmat_m1d*Te,bmat_mir];
      bmat_m2 = [bmat_m2d*Te,bmat_mir];
      bmat_m3 = [bmat_m3d*Te,bmat_mir];
      bmat_m4 = [bmat_m4d*Te,bmat_mir];

      bmat_m = [bmat_m1,bmat_m2,bmat_m3,bmat_m4];

%==================

%== Colocation Points:

 cx = [ 0 , 1 , 0 , -1 ];
 cy = [-1 , 0 , 1 ,  0 ];
 
 c     = zeros(8,8);
 b_bar = [];
 for i = 1 : 4
    N(1) = (1-cx(i))*(1-cy(i))/4 ;
    N(2) = (1+cx(i))*(1-cy(i))/4 ;
    N(3) = (1+cx(i))*(1+cy(i))/4 ;
    N(4) = (1-cx(i))*(1+cy(i))/4 ;
  
    dxNl(1) = (-1+cy(i))/4;
    dxNl(2) = ( 1-cy(i))/4;
    dxNl(3) = ( 1+cy(i))/4;
    dxNl(4) = (-1-cy(i))/4;

    dyNl(1) = (-1+cx(i))/4;
    dyNl(2) = (-1-cx(i))/4;
    dyNl(3) = ( 1+cx(i))/4;
    dyNl(4) = ( 1-cx(i))/4;

    xjacm(1,1) = x(1)*dxNl(1) + x(2)*dxNl(2) + x(3)*dxNl(3) + x(4)*dxNl(4);
    xjacm(1,2) = y(1)*dxNl(1) + y(2)*dxNl(2) + y(3)*dxNl(3) + y(4)*dxNl(4);
    xjacm(2,1) = x(1)*dyNl(1) + x(2)*dyNl(2) + x(3)*dyNl(3) + x(4)*dyNl(4);
    xjacm(2,2) = y(1)*dyNl(1) + y(2)*dyNl(2) + y(3)*dyNl(3) + y(4)*dyNl(4);

    jpos = [ i*2-1 , i*2 ];
    c(jpos,jpos) = xjacm;
  
    bmat_s1  = [ dxN(1), -N(1),    0  ;
                 dyN(1),     0, -N(1)];
             
    bmat_s2  = [ dxN(2), -N(2),    0  ;
                 dyN(2),     0, -N(2)];
               
    bmat_s3  = [ dxN(3), -N(3),    0  ;
                 dyN(3),     0, -N(3)];
               
    bmat_s4  = [ dxN(4), -N(4),    0  ;
                 dyN(4),     0, -N(4)];

    bmat_s = [bmat_s1,bmat_s2,bmat_s3,bmat_s4];
  
    b_bar = [ b_bar ;
              bmat_s];
 end
 
 T_mat = [ 1 , 0 , 0 , 0 , 0 , 0 , 0 , 0 ;
           0 , 0 , 0 , 1 , 0 , 0 , 0 , 0 ;
           0 , 0 , 0 , 0 , 1 , 0 , 0 , 0 ;
           0 , 0 , 0 , 0 , 0 , 0 , 0 , 1 ];
      
 P_mat = [ 1 , -1 ,  0 ,  0 ;
           0 ,  0 ,  1 ,  1 ;
           1 ,  1 ,  0 ,  0 ;
           0 ,  0 ,  1 , -1 ];
      
 A_mat = [ 1 , ygs , 0 ,   0 ;
           0 ,   0 , 1 , xgs ]; 
      
 bmat_ss = xjaci * A_mat * inv(P_mat) * T_mat * c * b_bar;

 bmat_s1 = [0 , 0 ,bmat_ss(1, 1);
            0 , 0 ,bmat_ss(2, 1)];
 bmat_s2 = [0 , 0 ,bmat_ss(1, 4);
            0 , 0 ,bmat_ss(2, 4)];
 bmat_s3 = [0 , 0 ,bmat_ss(1, 7);
            0 , 0 ,bmat_ss(2, 7)];
 bmat_s4 = [0 , 0 ,bmat_ss(1,10);
            0 , 0 ,bmat_ss(2,10)];

 bmat_s1 = [bmat_s1*Te,bmat_ss(:, 2: 3)];
 bmat_s2 = [bmat_s2*Te,bmat_ss(:, 5: 6)];
 bmat_s3 = [bmat_s3*Te,bmat_ss(:, 8: 9)];
 bmat_s4 = [bmat_s4*Te,bmat_ss(:,11:12)];

 bmat_s = [bmat_s1,bmat_s2,bmat_s3,bmat_s4];

