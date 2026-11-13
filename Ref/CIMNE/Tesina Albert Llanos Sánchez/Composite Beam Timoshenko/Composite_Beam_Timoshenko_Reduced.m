%% 2 Nodes Composite Beam using Timoshenko Theory 
% Reduce the influence of the transverse shear stiffness (thick and slender
% beams)
% Clear memory and variables.
  clear
  
% The variables are read as a MAT-fem subroutine
% layers      =     Number of layers
% young       =     Young Modulus
%                   matrix size: layers x 1
% poiss       =     Poission Ratio
%                   matrix size: layers x 1
% denss       =     Material density 
%                   matrix size: layers x 1
% thickness   =     thickness of every layer
%                   matrix size: layers x 1
% width       =     width of every layer
%                   matrix size: layers x 1
% coordinates =     [x]  matrix size: nnode x ndime (1)
% elements    =     [ inode, jnode ] element conectivity matrix
%                   matrix size: nelem x nnode; nnode = 2 
% fixnodes    =     [node number, dof, fixed value] matrix with 
%                   Dirichlet restrictions, were dof=1 for horizontal 
%                   displacement, dof=2 for vertical displacement 
%                   and dof=3 for vertical derivative.
% pointload   =     [node number, dof, load value] matrix with 
%                   nodal loads, were dof=1 for horizontal load, 
%                   dof=2 for vertical load and dof=3 for moment.
% uniload     =     [ uniform load ] sparse matrix size: nelem x 2
 

  file_name = input('Enter the file name :','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval (file_name);      % Read input file

% Finds basics dimensions
  npnod  = size(coordinates,1);        % Number of nodes
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  dofpn  = 3;                          % Number of DOF per node
  dofpe  = nnode*dofpn;                % Number of DOF per element
  nndof  = npnod*dofpn;                % Number of total DOF 

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices.
  
  StifMat  = sparse ( nndof , nndof ); % Create the global stiffness matrix
  force    = sparse ( nndof , 1 );     % Create the global force vector
  force1   = sparse ( nndof , 1 );     % Create the global force vector
  reaction = sparse ( nndof , 1 );     % Create the global reaction vector
  u        = sparse (nndof, 1);        % Nodal variables
  
% Material properties (Constant over the domain)

shear =  young./(2*(1+poiss));
area = thickness'*width ;

%   Create coordinate z vector of points between each layer 

coord_z = [zeros(1);thickness] ;
    for j=2:layers+1  
        coord_z(j,1) = coord_z(j,1)+coord_z(j-1,1); % Coordinate z respect  
    end                                             % the bottom of the    
                                                    % section
    for i=1:layers
        zg_layers(i)=(coord_z(i)+coord_z(i+1))*0.5; % Center of gravity of 
    end                                             % each layer 

    for i=1:layers
        area_layers(i)=thickness(i)*width(i);       % Area of each layer
    end

coord_zg = (area_layers*zg_layers')/area;       % Center of gravity of the
                                                % section
                                                
coord_ZG = coord_z-(coord_zg*ones(layers+1,1)); % Coordinate z respect the
                                                % center of gravity of the
                                                % section
%   Components of the generalized constitutive matrix

%   Axial stiffness
D_mata = 0;
    for i=1:layers 
        D_mata = D_mata + width(i) * thickness (i) * young(i);
    end
    
%   Bending stiffness
D_matb = 0 ;  
    for i=1:layers
        D_matb = D_matb + (1/3)*((coord_ZG(i+1))^3-(coord_ZG(i))^3)*width(i)*young(i);
    end
    
%   Coupling axial-bending stiffness
D_matab = 0;  
    for i = 1:layers
        D_matab = D_matab+(-1/2)*(coord_ZG(i+1)+coord_ZG(i))*width(i)*thickness(i)*young(i);
    end

%   Shear stiffness    
D_mats=0;
    for i=1:layers
        D_mats = D_mats + thickness(i)*width(i)*(young(i)/(2*(1+poiss(i))));
    end

%   Compute the shear correction parameter for bending around the y axis
%   (kz)
 
S1 = 0;                       
S3 = 0;
  for i = 1 : layers
    if i > 1
        S1 = S1 + young(i-1)* (coord_ZG(i)^2 - coord_ZG(i-1)^2);
    end
    S2 = 1/20*young(i)^2*(coord_ZG(i+1)^5-coord_ZG(i)^5)+...
         1/6*(S1-young(i)*coord_ZG(i)^2) * young(i) * (coord_ZG(i+1)^3-coord_ZG(i)^3)+... 
         1/4*(S1-young(i)*coord_ZG(i)^2)^2 * (coord_ZG(i+1)-coord_ZG(i));   
    S3 = S3 + width(i)/shear(i)*S2 ;
  end
  kz = D_matb^2/D_mats/S3;        

%   New shear stiffness

D_mats =  kz*D_mats; 

%   Vertical distance between the global axis x and the neutral axis. 

d = - D_matab / D_mata ;

%   Create coordinate z vector of points between each layer respect 
%   neutral axis

coord_zp = coord_ZG-(d*ones(layers+1,1)); 

%   New coupling axial-bending stiffness
D_matab=0;
    for i = 1:layers
        D_matab =D_matab + (-1/2)*(coord_zp(i+1)+coord_zp(i))*width(i)*thickness(i)*young(i);
    end
    
    
ttim = timing('Time needed to  set initial values',ttim); %Reporting time

%  Element cycle

  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate

    len = coor_x(2) - coor_x(1);  % x_j > x_i
   
    const = D_matb/len;
    
    K_bend  = [ 0 ,  0 ,  0 ,  0 ;
                0 ,  1 ,  0 , -1 ;
                0 ,  0 ,  0 ,  0 ;
                0 , -1 ,  0 ,  1 ];
            
    K_bend = K_bend * const;
      
    const =   D_mats/len;
    
    K_shear = [   1   ,   len/2 ,   -1   ,   len/2 ;
                len/2 , len^2/4 , -len/2 , len^2/4 ;
                 -1   ,  -len/2 ,    1   ,  -len/2 ;
                len/2 , len^2/4 , -len/2 ,  len^2/4 ];
            
    K_shear = K_shear * const;
            
    K_flex = K_bend + K_shear;
  
    const = D_mata/len;
    
    K_axial = [ 1 , -1 ;
               -1 , 1 ];
      
    K_axial = K_axial * const ;
    
    K_elem = [K_axial , zeros(2,4);
             zeros(4,2) , K_flex ];
         
   K_elem(:,[2 3]) = K_elem(:,[3 2]);
   K_elem(:,[3 4]) = K_elem(:, [4 3]);
   
   K_elem([2,3],:)=K_elem([3 2],:);
   K_elem([3,4],:)=K_elem([4 3],:);
   
   pp = thickness.*width.*denss;
   
   fa = uniload(ielem,1) * len/2 ;
   fz = (-sum(pp) + uniload(ielem,2))* len/2;
   
   ElemFor = [ fa, fz , 0, fa, fz, 0];  %elemental force vector. 

% Finds the equation number list for the i-th element
     for i=1:nnode
     ii = (i-1)*dofpn;
     for j =1:dofpn
       eqnum(ii+j) = (lnods(i)-1)*dofpn+j; % Build the equation number list
     end
    end

% Assemble the force vector and the stiffness matrix
    for i = 1 : dofpe
      ipos = eqnum(i);
      force (ipos) = force(ipos)  + ElemFor(i);
      for j = 1 : dofpe
         jpos = eqnum(j);
         StifMat (ipos,jpos) = StifMat (ipos,jpos) + K_elem(i,j);
      end
    end

  end  % End element cycle
  
  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add point loads conditions to the force vector

  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*dofpn+pointload(i,2);      % Finds eq. number
    force(ieqn) = force(ieqn) + pointload(i,3);          % add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

 % Applies the Dirichlet conditions and adjust the right hand side.

  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*dofpn+fixnodes(i,2) ;     % Finds eq. number
    u (ieqn) = fixnodes(i,3);               % and store the solution in u
    fix(i) = ieqn ;                       % and mark the eq as a fix value
  end
  
  force1 = force  - StifMat  * u ;    % adjust the rhs with the known values

%  Compute the solution by solving StifMat * u = force for the 
%  remaining unknown values of u.

  FreeNodes = setdiff ( 1:nndof, fix ); % Finds the free node list and

  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ force1(FreeNodes);

  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time


% Compute the layer's results  

  [Dsp_lyr Str_lyr ResStr_lyr] = Composite_Layers_Beam_Timoshenko(layers,young,shear,poiss,kz,width,thickness,coord_ZG,coord_zp,u);

  ttim = timing('Time to  solve the  layer  results',ttim); %Reporting time

% Graphic representation.

  ToGiD_Composite_Beam_Timoshenko(file_name,layers,coord_ZG,u,Dsp_lyr,Str_lyr,ResStr_lyr);

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\n Total running time %12.6f \n',ttim);  %Reporting final time

